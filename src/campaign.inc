    enum class DayPhase {Preparation,Open,Closing,Summary};
    struct Regular {
        int preference=0;
        std::uint64_t visits=0,reviews=0,satisfaction=0,lastDay=0;
        int lastScore=0;
    };
    struct Campaign {
        bool enabled=false;
        DayPhase phase=DayPhase::Preparation;
        std::uint64_t day=1,goals=0,mixed=0;
        std::int64_t openedAt=0;
        std::array<std::int64_t,12> baseline{};
        std::array<Regular,3> regulars{{{0},{1},{2}}};
        std::vector<std::uint8_t> checkpoint;
    } campaign;
    static constexpr std::int64_t shiftLength=600000,dayOverhead=500,goalReward=500;
    static constexpr std::array<const char*,3> regularNames{"Maja","Leo","Nora"};
    static constexpr std::array<const char*,4> goalNames{"First paid service","Serve a mixed order","Clean full shift (optional)","Finish a profitable day"};
    std::string campaignMessage;
    bool summary() const {return campaign.enabled && campaign.phase==DayPhase::Summary;}
    std::size_t campaignSaveBytes() const {return campaign.enabled?(1+5+12+18+1+guests.size()*2+1+campaign.checkpoint.size())*8:8;}
    bool campaignWorking() const {return !intermission() && (!campaign.enabled || campaign.phase==DayPhase::Open || campaign.phase==DayPhase::Closing);}
    int unlockedMask() const {
        int mask=campaign.enabled?(17 | (campaign.goals&1?2:0) | (campaign.goals&2?12:0)):31;
        if(summerProgress()){mask|=128;if(coldStation)mask|=96;}return mask;
    }
    bool unlocked(int product) const {return product>=0 && product<8 && (unlockedMask()&(1<<product));}
    std::array<std::int64_t,12> campaignTotals() const {
        return {credited("cafe:sales"),debited("cafe:purchases")-credited("cafe:refunds"),expectedWages(),
            debited("cafe:maintenance")-credited("cafe:repair-refunds"),debited("cafe:furniture-buys")-credited("cafe:furniture-sales")+debited("garden:table-buys")-credited("garden:table-sales"),
            debited("cafe:hires"),wasted,std::int64_t(reviewCount()),std::int64_t(totalSatisfaction),std::int64_t(failedReviews),served,debited("cafe:upgrades")-credited("cafe:resale")};
    }
    std::array<std::int64_t,12> dayTotals() const {
        auto values=campaignTotals();for(std::size_t n=0;n<values.size();++n)values[n]-=campaign.baseline[n];return values;
    }
    std::int64_t dayProfit() const {auto d=dayTotals();return d[0]-d[1]-d[2]-d[3]-d[4]-d[5]-d[11]-(summary()?dayOverhead:0);}
    std::int64_t overheadDue() const {
        return campaign.enabled?std::int64_t(campaign.day-1+(summary()?1:0))*dayOverhead-debited("cafe:overhead"):0;
    }
    bool startCampaign(std::uint32_t seed=1831565813u) {
        if(!seed)return false;
        Simulation candidate{24,10000};candidate.immediate=immediate;
        candidate.campaign.enabled=true;candidate.closed=true;candidate.automaticGuests=true;candidate.automaticSupply=true;
        require(candidate.demandRandom.restore({seed,0}));candidate.arrivals.remaining=5000;
        if(!load(candidate.save()))return false;
        campaignMessage="Prepare your cafe, then open day 1. Espresso and croissants are available.";return true;
    }
    bool openDay() {
        if(!campaign.enabled || campaign.phase!=DayPhase::Preparation || !guests.empty() || active() || !tasks->tasks().empty() || incomingSupply())return false;
        if(gardenStory.party==GardenParty::Prepared && !gardenPartyReason(true).empty())return false;
        // A bounded, nonrecursive opening checkpoint rolls back the ENTIRE day.
        campaign.checkpoint.clear();auto checkpoint=save();
        if(checkpoint.size()>524288)return false;
        campaign.checkpoint=std::move(checkpoint);campaign.phase=DayPhase::Open;campaign.openedAt=runtime->time();
        closed=false;automaticGuests=true;require(arrivals.restore(5000));gardenOpening();campaignMessage.clear();return true;
    }
    bool closeDay() {
        if(!campaign.enabled || campaign.phase!=DayPhase::Open)return false;
        campaign.phase=DayPhase::Closing;closed=true;
        schedule.stage=PeriodStage::Finishing;
        campaignMessage="Closing: finish queued tickets, let guests leave and complete cleanup. Resume staff or enable their roles if work is waiting.";
        return true;
    }
    bool nextDay() {
        if(!summary() || campaign.day>=365 || wagesDue() || overheadDue())return false;
        ++campaign.day;campaign.phase=DayPhase::Preparation;campaign.openedAt=runtime->time();
        schedule={campaign.day,0,0,PeriodStage::Service};
        campaign.baseline=campaignTotals();campaign.checkpoint.clear();pending=0;fraction=0;
        journalNextDay();
        campaignMessage="Prepare the next day. Stock and staff carry over. Wages begin when you open.";return true;
    }
    bool restartDay() {
        if(!campaign.enabled || campaign.checkpoint.empty())return false;
        auto checkpoint=campaign.checkpoint;
        if(!load(checkpoint,true))return false;
        campaign.checkpoint=std::move(checkpoint);
        campaignMessage="Day restarted at its opening checkpoint. Purchases, wages, visits and rewards after opening were rolled back.";return true;
    }
    void campaignReview(const Guest& g,int outcome,int score) noexcept {
        if(!campaign.enabled || outcome==3)return;
        journalReview(g,outcome,score);
        gardenReview(g,outcome,score);
        if(outcome==1 && g.items[1]>=0)++campaign.mixed;
        if(g.regular>=0 && g.regular<3) {
            auto& r=campaign.regulars[std::size_t(g.regular)];++r.reviews;r.satisfaction+=std::uint64_t(score);r.lastScore=score;
        }
    }
    void campaignTick() {
        if(!campaign.enabled)return;
        if(campaign.phase==DayPhase::Open && schedule.elapsed>=shiftLength)closeDay();
        if(campaign.phase==DayPhase::Closing && !active() && queue.claims().empty() && !maintenanceTask && machineCondition.snapshot().cleanliness<1000)requestMaintenance(Maintenance::Clean);
        bool finished=false;
        if(campaign.phase==DayPhase::Closing && guests.empty() && !active() && tasks->tasks().empty() && !incomingSupply()) {
            campaign.phase=DayPhase::Summary;pending=0;fraction=0;finished=true;
        }
        auto d=dayTotals();auto full=schedule.elapsed>=shiftLength;
        std::array<bool,4> completed{served>0,campaign.mixed>0,summary() && full && d[10]>0 && !d[9] && !d[6] && machineCondition.snapshot().cleanliness==1000,summary() && d[10]>0 && dayProfit()>0};
        for(int n=0;n<4;++n) {
            auto bit=std::uint64_t(1)<<n;
            if(campaign.goals&bit)continue;
            if(!completed[std::size_t(n)])continue;
            require(ledger->post("cafe:goals",ledger->sequence("cafe:goals")+1,goalReward,runtime->time()));
            campaign.goals|=bit;syncCash();
        }
        if(finished) {
            journalClose();
            settleWages();auto amount=std::min<std::int64_t>(dayOverhead,wallet);
            if(amount)require(ledger->post("cafe:overhead",ledger->sequence("cafe:overhead")+1,-amount,runtime->time()));
            syncCash();
            gardenClosing();
        }
        gardenStoryTick();
        scheduleTick();
    }
    template<class Put> void saveCampaign(Put put) const {
        put(campaign.enabled);
        if(!campaign.enabled)return;
        put(std::uint64_t(campaign.phase));put(campaign.day);put(campaign.goals);put(campaign.mixed);put(campaign.openedAt);
        for(auto n:campaign.baseline)put(n);
        for(const auto& r:campaign.regulars){put(r.preference);put(r.visits);put(r.reviews);put(r.satisfaction);put(r.lastDay);put(r.lastScore);}
        put(guests.size());for(const auto& g:guests){put(g.id.value);put(g.regular+1);}
        put(campaign.checkpoint.size());for(auto b:campaign.checkpoint)put(b);
    }
    template<class Get> bool loadCampaign(Get get,bool checkpointOnly,bool hasEquipment=true,bool hasSchedule=true,bool hasStory=false) {
        auto enabled=get();if(enabled>1)return false;campaign.enabled=bool(enabled);
        if(!enabled)return !ledger->sequence("cafe:overhead") && !ledger->sequence("cafe:goals") && !(closed && !queue.claims().empty());
        auto phase=get(),day=get(),goals=get(),mixed=get(),opened=get();
        if(phase>3 || day<1 || day>365 || (goals>15 || ((goals&2) && !(goals&1))) || mixed>deliveredReviews || opened>std::uint64_t(runtime->time()))return false;
        campaign.phase=DayPhase(phase);campaign.day=day;campaign.goals=goals;campaign.mixed=mixed;campaign.openedAt=std::int64_t(opened);
        auto totals=campaignTotals();
        for(std::size_t n=0;n<(hasEquipment?totals.size():11);++n){auto v=std::bit_cast<std::int64_t>(get());if(v < -1000000000 || v>1000000000 || ((n!=1 && n!=3 && n!=4 && n!=11) && (v<0 || v>totals[n])))return false;campaign.baseline[n]=v;}
        std::uint64_t visits=0,reviews=0,scores=0;
        for(std::size_t n=0;n<3;++n) {
            auto p=get(),v=get(),r=get(),s=get(),d=get(),last=get();
            if(p!=n || v>admitted || r>v || s>r*1000 || d>day || bool(v)!=bool(d) || last>1000 || (!r && last))return false;
            campaign.regulars[n]={int(p),v,r,s,d,int(last)};visits+=v;reviews+=r;scores+=s;
        }
        if(visits>admitted || reviews>reviewCount() || scores>totalSatisfaction)return false;
        auto count=get();if(count!=guests.size())return false;
        std::array<bool,3> present{};
        for(auto& g:guests) {
            auto id=get(),r=get();if(id!=g.id.value || r>(hasStory?6u:3u))return false;g.regular=int(r)-1;
            if(r && r<=3){auto& reg=campaign.regulars[r-1];if(present[r-1] || !reg.visits || reg.lastDay!=day || g.profile!=int(r)-1 || (g.rating && g.rating!=3 && !reg.reviews))return false;present[r-1]=true;}
            for(int p:g.items)if(p>=0 && !unlocked(p))return false;
        }
        auto length=get();if(length>524288 || (checkpointOnly && length))return false;
        campaign.checkpoint.reserve(std::size_t(length));while(length--){auto b=get();if(b>255)return false;campaign.checkpoint.push_back(std::uint8_t(b));}
        if(closed!=(campaign.phase!=DayPhase::Open || (hasSchedule && schedule.stage!=PeriodStage::Service)) || (!hasSchedule && campaign.phase==DayPhase::Open && runtime->time()-campaign.openedAt>=shiftLength))return false;
        if((campaign.phase==DayPhase::Preparation || summary()) && (!guests.empty() || active()))return false;
        if(summary() && (!tasks->tasks().empty() || incomingSupply() || pending))return false;
        auto completed=day-1+(summary()?1:0);
        if(credited("cafe:overhead") || debited("cafe:overhead")>std::int64_t(completed)*dayOverhead || ledger->sequence("cafe:overhead")>completed ||
           debited("cafe:goals") || credited("cafe:goals")!=std::popcount(goals)*goalReward || ledger->sequence("cafe:goals")!=std::uint64_t(std::popcount(goals)))return false;
        if(goals && !served)return false;if((goals&2) && !mixed)return false;
        if(!summary() && overheadDue())return false;
        if(summary() && overheadDue() && wallet)return false;
        if(campaign.phase!=DayPhase::Preparation && campaign.checkpoint.empty())return false;
        if(!campaign.checkpoint.empty()) {
            Simulation start;
            start.contentAccess=contentAccess;
            if(!start.load(campaign.checkpoint,true) || !start.campaign.enabled || start.campaign.day!=day || start.campaign.phase!=DayPhase::Preparation ||
               start.gardenState.selected!=gardenState.selected ||
               start.gardenState.restoration!=gardenState.restoration ||
               start.runtime->time()>runtime->time() || (start.campaign.goals&goals)!=start.campaign.goals || start.campaign.baseline!=campaign.baseline ||
               start.credited("cafe:sales")>credited("cafe:sales") || start.debited("cafe:overhead")!=std::int64_t(day-1)*dayOverhead)return false;
        }
        return true;
    }
