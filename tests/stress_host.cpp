#include "balance.hpp"
#include "runtime_scale.hpp"
#include <charconv>
#include <iostream>

namespace {
void require(bool value,const char* message){if(!value)throw std::runtime_error(message);}
void stressCommands(cafe::Simulation& g,int tick) {
    using Care=cafe::Simulation::Maintenance;
    const int phase=tick%2000;
    if(phase==0 && tick && !g.closed)g.toggleClosed();
    if(phase==100 && g.layoutEditable())g.editLayout(0,1,g.layout.find(1)->x==4?3:4,10,0);
    if(phase==120 && g.closed)g.toggleClosed();
    if(tick%1301==0 && g.incomingSupply())g.cancelSupply();
    if(tick%971==0 && g.active())g.cancel();
    if(tick%1201==0 && !g.active())g.requestMaintenance(Care::Clean);
    if(tick%1201==1 && g.maintenanceTask)g.cancelMaintenance();
    if(tick%701==0 && g.storedBeans().available())g.requestRestock(0);
    if(g.crew.size()>1) {
        auto id=g.crew[1].id;
        if(tick%1901==0 && g.onShift(id) && !g.member(id)->breakPending)g.staffBreak(id);
        if(tick%1901==40 && !g.onShift(id))g.staffBreak(id);
    }
    const bool breakTime=tick%1601<30;
    if(breakTime && g.onShift() && !g.member(g.staff)->breakPending)g.takeBreak();
    cafe::referenceDecisions(g,!breakTime);
}
std::uint32_t number(std::string_view text) {
    std::uint32_t value=0;auto result=std::from_chars(text.data(),text.data()+text.size(),value);
    if(result.ec!=std::errc{} || result.ptr!=text.data()+text.size() || !value)throw std::invalid_argument("Expected positive uint32");return value;
}
}
int main(int argc,char** argv) {
    try {
        if(argc<3 || argc>4)throw std::invalid_argument("Usage: cafe_stress SECONDS SEED [MAX_SCALE_RECORDS]; duration 60..86400, scale 16..1024");
        auto seconds=number(argv[1]),seed=number(argv[2]),scale=argc==4?number(argv[3]):256;
        if(seconds<60 || seconds>86400 || scale<16 || scale>1024)throw std::invalid_argument("Stress bounds exceeded");
        cafe::Simulation control,replay;auto scenario=cafe::scenarios[0];scenario.seed=seed;
        require(cafe::startScenario(control,scenario) && cafe::startScenario(replay,scenario),"Stress scenario rejected");
        require(control.hire() && control.hire() && replay.hire() && replay.hire(),"Stress crew hiring failed");
        engine::simulator::ContentHash digest;std::size_t checkpoints=0,peakSave=0,peakGuests=0,peakJobs=0,peakLedger=0;
        std::vector<std::int64_t> batches;auto batchStart=std::chrono::steady_clock::now();
        for(int tick=0;tick<int(seconds)*10;++tick) {
            stressCommands(control,tick);stressCommands(replay,tick);control.advance(.1);replay.advance(.1);
            auto metrics=control.runtime->metrics();
            peakGuests=std::max(peakGuests,metrics.customers);peakJobs=std::max(peakJobs,metrics.jobs);peakLedger=std::max(peakLedger,control.ledger->entries().size());
            require(metrics.customers<=8 && metrics.jobs<=18 && metrics.orders<=8 && metrics.receipts<=8 && metrics.reservations<=1,"Retained core records grew beyond live Cafe ownership");
            require(metrics.events==0 && control.tasks->tasks().size()<=32 && control.ledger->entries().size()<=128,"Outbox/task/ledger history growth");
            if(tick%997==0 || tick==int(seconds)*10-1) {
                auto a=control.save(),b=replay.save();require(a==b,"Checkpoint replay diverged");peakSave=std::max(peakSave,a.size());
                require(a.size()<=128*1024,"Cafe snapshot grew beyond bounded session budget");
                auto stale=replay.customer;auto result=replay.restore(b);require(bool(result) && !result.migrated && replay.save()==b,"Checkpoint restore is not canonical");
                if(stale)require(!replay.runtime->customer(stale),"Restore retained a stale handle");
                digest.word(engine::simulator::checkpointHash(a));++checkpoints;
            }
            if(tick%1000==999) {
                batches.push_back(std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now()-batchStart).count());batchStart=std::chrono::steady_clock::now();
            }
        }
        require(control.runtime->time()==std::int64_t(seconds)*1000 && control.served>0 && control.reviewCount()>0,"Stress made no meaningful progress");
        require(control.save()==replay.save(),"Final replay diverged");std::sort(batches.begin(),batches.end());
        std::string scales="[";for(std::size_t count=16;count<=scale;count*=4) {
            auto measured=runtimeScale(count);if(scales.size()>1)scales+=",";
            scales+="{\"records\":"+std::to_string(count)+",\"snapshotBytes\":"+std::to_string(measured.snapshotBytes)+",\"enqueueUs\":"+std::to_string(measured.enqueueUs)+",\"idle1000TicksUs\":"+std::to_string(measured.idleUs)+",\"productionUs\":"+std::to_string(measured.productionUs)+"}";
        }scales+="]";
        std::cout<<"{\"schema\":1,\"kind\":\"stress-replay\",\"seconds\":"<<seconds<<",\"seed\":"<<seed<<",\"checkpoints\":"<<checkpoints<<",\"digest\":"<<cafe::jsonText(std::to_string(digest.value()))
            <<",\"peakSaveBytes\":"<<peakSave<<",\"peakGuests\":"<<peakGuests<<",\"peakJobs\":"<<peakJobs<<",\"peakLedgerEntries\":"<<peakLedger
            <<",\"p50BatchUs\":"<<(batches.empty()?0:batches[batches.size()/2])<<",\"p95BatchUs\":"<<(batches.empty()?0:batches[(batches.size()-1)*95/100])
            <<",\"batchTicks\":1000,\"finalHash\":"<<cafe::jsonText(std::to_string(engine::simulator::checkpointHash(control.save())))<<",\"final\":"<<cafe::shiftReport(control)<<",\"scale\":"<<scales<<"}\n";
    } catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
