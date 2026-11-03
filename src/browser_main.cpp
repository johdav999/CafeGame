#include "cafe_scene.hpp"
#include "diagnostics.hpp"
#include "engine/application.hpp"
#include "engine/renderer.hpp"
#include "engine/audio_browser.hpp"
#include "engine/selection.hpp"
#include <emscripten.h>
#include <deque>
namespace {
engine::Application app;
std::unique_ptr<engine::Renderer> renderer;
cafe::CafeScene* scene = nullptr;
cafe::Simulation game{4,5000};
struct Command {int kind,action=0,id=0;double x=0,z=0;int rotation=0;};
std::deque<Command> commands;
bool paused = false;
std::unique_ptr<engine::AudioSystem> audio;
enum Cue : std::size_t {Brew,Cup,Door,Ambience,Grinder,Steam,Payment,Ready,Pour,Pastry,Clean,Ui,Appeal,CueCount};
std::array<std::shared_ptr<const engine::SoundAsset>,CueCount> sounds;
std::array<unsigned,CueCount> cueCounts{};
engine::AudioBusId effectsBus,ambienceBus;
engine::AudioVoiceId ambienceVoice;
bool hostAlive=true;
int uiWidth=1280,uiHeight=720;
engine::AudioVoiceId playCue(std::size_t id,float volume=1) {
    if(audio && id<sounds.size() && audio->backend().active() && sounds[id]){
        engine::AudioPlayOptions options;options.bus=effectsBus;options.volume=volume;
        auto voice=audio->play(sounds[id],options);if(voice)++cueCounts[id];return voice;
    }
    return {};
}
// Presentation follows accepted production/workflow state; it never drains the
// simulator's events or changes gameplay clocks, jobs or saved state.
struct RunningCue {std::uint64_t id;bool task;std::size_t cue;};
struct WorkVoice {RunningCue work;engine::AudioVoiceId voice;};
std::vector<WorkVoice> workVoices;
engine::AudioVoiceId grinderVoice;
std::vector<RunningCue> runningCues() {
    std::vector<RunningCue> result;
    for(auto id:game.productionJobs()) {
        auto j=game.runtime->job(id);if(!j || j.value.state!=cafe::sim::JobState::Running)continue;
        const auto& process=j.value.process.value;
        std::size_t cue=process=="cafe:latte"?Steam:process=="cafe:americano" || process=="cafe:tea"?Pour:process=="cafe:croissant" || process=="garden:berry-cake"?Pastry:process=="garden:iced-coffee" || process=="garden:lemonade"?Pour:Brew;
        result.push_back({id.value,false,cue});
    }
    for(const auto& t:game.tasks->tasks())if(t.state==cafe::sim::TaskState::Running &&
        (t.spec.key=="cafe:clean" || t.spec.key=="cafe:machine-clean"))result.push_back({t.id.value,true,Clean});
    return result;
}
bool containsWork(const std::vector<RunningCue>& list,const RunningCue& work) {
    return std::any_of(list.begin(),list.end(),[&](const auto& v){return v.id==work.id && v.task==work.task;});
}
void publish() {
    EM_ASM({
        const status=document.getElementById('garden-status');
        if(status)status.textContent=UTF8ToString($0);
        window.cafeGardenState=({installed:!!$1,owned:!!$2,selected:!!$3,locked:!$4,open:!!$4,tables:$5});
        window.cafeGardenUpdate?.(window.cafeGardenState,!!$6);
    },game.gardenStatus(),game.contentAccess.installed,game.contentAccess.owned,game.gardenState.selected,game.courtyardOpen(),game.gardenLayout.placements().size(),game.layoutEditable());
    const auto selected=scene?scene->selectedStaff():0;
    EM_ASM({window.cafeStaffSelection?.($0);},double(selected));
    std::string animations="[";
    if(scene)for(const auto& a:scene->staffAnimations()){
        if(animations.size()>1)animations+=",";
        animations+="{\"worker\":"+std::to_string(a.worker)+",\"clip\":\""+(a.moving?"Walking":"Idle")+"\",\"time\":"+std::to_string(a.time)+",\"poseRevision\":"+std::to_string(a.poseRevision)+",\"x\":"+std::to_string(a.x)+",\"z\":"+std::to_string(a.z)+",\"yaw\":"+std::to_string(a.yaw)+"}";
    }
    animations+="]";EM_ASM({window.cafeStaffAnimations=JSON.parse(UTF8ToString($0));},animations.c_str());
    std::string guests="[";
    if(scene)for(const auto& a:scene->guestAnimations()) {
        if(guests.size()>1)guests+=",";
        guests+="{\"guest\":"+std::to_string(a.guest)+",\"model\":"+std::to_string(a.model)+",\"clip\":\""+a.clip+"\",\"time\":"+std::to_string(a.time)+",\"poseRevision\":"+std::to_string(a.poseRevision)+",\"x\":"+std::to_string(a.x)+",\"z\":"+std::to_string(a.z)+",\"yaw\":"+std::to_string(a.yaw)+"}";
    }
    guests+="]";EM_ASM({window.cafeGuestAnimations=JSON.parse(UTF8ToString($0));},guests.c_str());
    std::string pins="[";
    if(scene)for(const auto& pin:scene->guestPins(float(uiWidth),float(uiHeight))){if(pins.size()>1)pins+=",";pins+="["+std::to_string(pin.guest)+","+std::to_string(pin.x)+","+std::to_string(pin.y)+","+(pin.visible?"true":"false")+","+std::to_string(pin.left)+","+std::to_string(pin.top)+","+std::to_string(pin.right)+","+std::to_string(pin.bottom)+"]";}
    pins+="]";EM_ASM({window.cafeWorldPins?.(UTF8ToString($0));},pins.c_str());
    auto equipment=cafe::equipmentView(game);EM_ASM({window.cafeEquipment?.(UTF8ToString($0));},equipment.c_str());
    auto campaign=cafe::campaignView(game);EM_ASM({window.cafeCampaign?.(UTF8ToString($0));},campaign.c_str());
    auto clock=cafe::clockView(game);EM_ASM({window.cafeClockState=JSON.parse(UTF8ToString($0));},clock.c_str());
    auto menu=cafe::menuView(game);EM_ASM({window.cafeMenu?.(UTF8ToString($0));},menu.c_str());
    auto crew=cafe::staffView(game);EM_ASM({window.cafeStaff?.(UTF8ToString($0));},crew.c_str());
    auto random=game.demandRandom.snapshot();
    std::string demand="{\"automatic\":"+std::to_string(game.automaticGuests)+",\"remaining\":"+std::to_string(game.arrivals.remaining)+
        ",\"admitted\":"+std::to_string(game.admitted)+",\"missed\":"+std::to_string(game.missed)+",\"reviews\":"+std::to_string(game.reviewCount())+
        ",\"average\":"+std::to_string(game.reputation())+",\"delivered\":"+std::to_string(game.deliveredReviews)+",\"failed\":"+std::to_string(game.failedReviews)+
        ",\"lastOutcome\":"+std::to_string(game.lastOutcome)+",\"lastScore\":"+std::to_string(game.lastScore)+",\"lastProfile\":"+std::to_string(game.lastProfile)+
        ",\"inputs\":["+std::to_string(game.lastInputs.wait)+","+std::to_string(game.lastInputs.product)+","+std::to_string(game.lastInputs.cleanliness)+","+std::to_string(game.lastInputs.preference)+
        "],\"random\":"+std::to_string(random.value)+",\"draws\":"+std::to_string(random.draws)+",\"saveBytes\":"+std::to_string(game.demandSaveBytes())+",\"guests\":[";
    for(const auto& g:game.guests) {
        if(demand.back()!='[')demand+=",";
        auto c=game.runtime->customer(g.id).value;
        demand+="{\"id\":"+std::to_string(g.id.value)+",\"profile\":"+std::to_string(g.profile)+",\"remaining\":"+std::to_string(game.guestPatience(g))+
            ",\"budget\":"+std::to_string(game.patienceBudget(g))+",\"rating\":"+std::to_string(g.rating)+",\"score\":"+std::to_string(g.score)+",\"phase\":"+std::to_string(int(g.phase))+"}";
    }
    demand+="]}";EM_ASM({window.cafeDemand?.(UTF8ToString($0));},demand.c_str());
    std::string furniture="[";
    for(auto p:game.layout.placements()) {
        if(furniture.size()>1)furniture+=",";
        furniture+="{\"id\":"+std::to_string(p.id)+",\"x\":"+std::to_string(p.x)+",\"z\":"+std::to_string(p.z)+",\"width\":"+std::to_string(p.width)+",\"depth\":"+std::to_string(p.depth)+",\"rotation\":"+std::to_string(p.rotation)+"}";
    }
    for(auto p:game.gardenLayout.placements()) {
        if(furniture.size()>1)furniture+=",";
        furniture+="{\"id\":"+std::to_string(p.id)+",\"x\":"+std::to_string(p.x+24)+",\"z\":"+std::to_string(p.z)+",\"width\":4,\"depth\":8,\"rotation\":"+std::to_string(p.rotation)+"}";
    }
    furniture+="]";
    EM_ASM({window.cafeLayout?.($0,$1,UTF8ToString($2),UTF8ToString($3));},game.closed,game.layoutEditable(),furniture.c_str(),game.layoutMessage.c_str());
    auto condition=game.machineCondition.snapshot();auto maintenance=game.tasks->task(game.maintenanceTask);
    auto fresh=game.drink?game.drink->sample(game.runtime->time()).value:cafe::sim::QualitySample{};
    EM_ASM({window.cafeQuality?.($0,$1,$2,$3,$4,$5,$6,$7,$8,UTF8ToString($9));},condition.integrity,condition.cleanliness,fresh.score,int(fresh.remaining),int(game.wasted),(game.maintenance==cafe::Simulation::Maintenance::QueuedClean?1:game.maintenance==cafe::Simulation::Maintenance::QueuedRepair?2:int(game.maintenance)),maintenance?int(maintenance->state):-1,maintenance?int(maintenance->remaining):0,game.machineUsable(),game.qualityMessage.c_str());
    std::string journal="[";const auto& entries=game.ledger->entries();
    for(std::size_t i=entries.size()>6?entries.size()-6:0;i<entries.size();++i) {
        if(journal.size()>1)journal+=",";
        const auto& e=entries[i];journal+="{\"stream\":\""+e.stream+"\",\"amount\":"+std::to_string(e.amount)+",\"time\":"+std::to_string(e.time)+"}";
    }
    journal+="]";
    EM_ASM({window.cafeEconomy?.($0,$1,$2,$3,$4,$5,$6,$7,UTF8ToString($8),UTF8ToString($9),$10,$11);},int(game.wallet),int(game.credited("cafe:sales")),int(game.debited("cafe:purchases")-game.credited("cafe:refunds")),int(game.debited("cafe:wages")),int(game.profit()),double(game.wagesDue()),int(game.availableCash()),double(game.staffedMs),game.economyMessage.c_str(),journal.c_str(),int(game.debited("cafe:maintenance")-game.credited("cafe:repair-refunds")),int(game.debited("cafe:furniture-buys")-game.credited("cafe:furniture-sales")));
    auto stored=game.storedBeans();auto incoming=game.incomingSupply();
    EM_ASM({window.cafeSupply?.($0,$1,$2,$3,$4);},int(stored.total),int(stored.reservedCapacity),incoming?int(std::max<std::int64_t>(0,incoming->deadline-game.runtime->time())):0,game.automaticSupply,bool(incoming));
    auto work=game.tasks->current(game.staff);
    auto key=work?work->spec.key:std::string{};
    auto dirty=std::count_if(game.guests.begin(),game.guests.end(),[](const auto& g){return bool(g.cleanup);});
    EM_ASM({window.cafeWorkflow?.(UTF8ToString($0),$1,$2,$3,$4);},key.c_str(),work?int(work->state):-1,game.onShift(),game.handoverReady(),dirty);
    auto waitingSeats=std::count_if(game.seats.claims().begin(),game.seats.claims().end(),[](const auto& c){return c.point==cafe::Simulation::Pool::waiting;});
    auto dining=std::count_if(game.guests.begin(),game.guests.end(),[](const auto& g){return g.phase==cafe::Simulation::GuestPhase::Dining;});
    EM_ASM({window.cafeOccupancy?.($0,$1,$2,$3,$4,$5);},game.queue.claims().size(),game.seats.claims().size()-waitingSeats,game.counter.claims().size(),game.guests.size(),dining,waitingSeats);
    if(scene) {auto p=scene->positions();EM_ASM({window.cafeTravel=({staffX:$0,guestX:$1});},p[0],p[1]);}
    EM_ASM({window.cafeUpdate?.({served:$0,coins:$1,brewing:$2,ready:!!$3,paused:!!$4});},
        game.served, game.coins, game.brewing, game.ready, paused);
    EM_ASM({window.cafeDiagnostics?.({order:$0,job:$1,stock:$2,inputHeld:$3,outputHeld:$4,patience:$5});},
        game.orderState,game.jobState,game.stock,game.inputHeld,game.outputHeld,game.patience);
    auto inspector=cafe::inspectShift(game,scene && scene->guestAtCounter(game));
    EM_ASM({window.cafeInspector?.(UTF8ToString($0));},inspector.c_str());
}
void saveMessage(const char* message) { EM_ASM({document.getElementById('save-status').textContent=UTF8ToString($0);},message); }
void frame() {
    try {
        const auto previousServed=game.served;
        const auto previousAdmitted=game.admitted;
        const bool wasReady=game.ready;
        const auto previousOrder=game.order;
        const auto previousWork=runningCues();
        bool replaced=false;
        while (!commands.empty()) {
            auto input=commands.front();commands.pop_front();int command=input.kind;
            if(command>=40 && command<=42 && !app.suspended()) {
                bool changed=command==40?game.selectGarden():command==41?game.openCourtyard():cafe::startGardenWorkshop(game);
                if(changed){replaced=true;scene->resetTravel();commands.clear();app.resetClocks();scene->cameraControl(0,0,0);}
            } else if(command==31 && !paused && !app.suspended()) {
                if(game.nextPeriod()){commands.clear();app.resetClocks();}
            } else if(command==30 && !app.suspended()) {
                auto x=cafe::sim::GridLayout::snap(input.x,-6,.5),z=cafe::sim::GridLayout::snap(input.z,-5,.5);
                if(input.action==3)game.setFinish(input.id);
                else if(input.action==4)game.setPlantStyle(input.id,int(input.x),input.rotation);
                else if(x && z && game.equipmentChange(input.action,input.id,*x,*z,input.rotation)){scene->resetTravel();commands.clear();app.resetClocks();}
            } else if(command==29 && !app.suspended()) {
                bool changed=false;
                if(input.action==0)changed=game.startCampaign();
                if(input.action==4)changed=game.restartDay();
                if(!paused) {
                    if(input.action==1)changed=game.openDay();
                    if(input.action==2)changed=game.closeDay();
                    if(input.action==3)changed=game.nextDay();
                }
                if(changed){replaced=true;scene->resetTravel();commands.clear();app.resetClocks();}
            } else if(command==20 && !app.suspended()) {
                if(input.id>=0 && std::size_t(input.id)<cafe::scenarios.size() && cafe::startScenario(game,cafe::scenarios[std::size_t(input.id)],false)) {
                    replaced=true;scene->resetTravel();commands.clear();app.resetClocks();saveMessage("Scenario started. Your device save is unchanged.");
                } else saveMessage("Scenario rejected. Your current shift is unchanged.");
            } else if(command==3) {
                auto bytes=game.save();
                int ok=EM_ASM_INT({return window.cafeStoreSave($0,$1);},bytes.data(),bytes.size());
                saveMessage(ok?"Shift saved on this device.":"Could not save this shift.");
            } else if(command==4) {
                int length=EM_ASM_INT({return window.cafeReadSave();});
                if(length>0&&std::size_t(length)<=cafe::Simulation::maxSaveBytes) {
                    std::vector<std::uint8_t> bytes(std::size_t(length),0);
                    EM_ASM({HEAPU8.set(window.cafePendingSave,$0);window.cafePendingSave=null;},bytes.data());
                    auto result=game.restore(bytes);replaced=bool(result);
                    if(result) {scene->resetTravel();commands.clear();app.resetClocks();saveMessage(result.migrated?"Saved shift restored and upgraded to the current format. Save shift to keep the upgrade.":"Saved shift restored.");}
                    else saveMessage(cafe::describeLoad(result.error));
                } else saveMessage("No valid saved shift found.");
            } else if(command==16 && !app.suspended()) {
                auto x=cafe::sim::GridLayout::snap(input.x,-6,.5),z=cafe::sim::GridLayout::snap(input.z,-5,.5);
                if(x && z && (cafe::garden::outdoorTable(input.id)?game.editGardenLayout(input.action,input.id,*x-24,*z,input.rotation):game.editLayout(input.action,input.id,*x,*z,input.rotation)))scene->resetTravel();
            } else if (command == 2) {
                paused = !paused;
                if (paused) app.pause(); else app.resume();
            } else if (!paused && !app.suspended() && !game.summary()) {
                if (command == 34) {
                    const int result=scene->moveSelectedStaff(game,input.id);
                    EM_ASM({window.cafeStaffMoveResult?.($0);},result);
                }
                if (command == 0) game.brew(false);
                if (command == 33 && game.nextCustomer()) game.brew(false);
                if (command == 32) {
                    cafe::sim::CustomerId id{std::uint64_t(input.id),game.runtime->epoch()};
                    if(input.action==0)game.collectOrder(id);
                    if(input.action==1)game.prepareGuest(id);
                    if(input.action==2)game.requestServing(id);
                }
                if (command == 1 && scene->guestAtCounter(game) && game.handoverReady()) game.serve(false);
                if (command == 5) game.cancel();
                if (command == 6) game.welcomeMenu(0);
                if (command == 7) game.takeBreak();
                if (command == 8) game.orderBeans();
                if (command == 9) game.restock();
                if (command == 10) game.automaticSupply=!game.automaticSupply;
                if (command == 11) game.cancelSupply();
                if (command == 12) game.requestMaintenance(cafe::Simulation::Maintenance::Clean);
                if (command == 13) game.requestMaintenance(cafe::Simulation::Maintenance::Repair);
                if (command == 14) game.cancelMaintenance();
                if (command == 15) game.toggleClosed();
                if (command == 17) game.automaticGuests=!game.automaticGuests;
                if (command == 18) game.welcomeMenu(1);
                if (command == 19) game.welcomeMenu(2);
                if (command>=21 && command<=24)game.prepare(command-20,false);
                if(command==44)game.prepare(input.id,false);
                if(command==45){bool changed=input.action==0?game.startGardenRestoration():input.action==1?game.prepareGardenParty():input.action==2?game.cancelGardenParty():game.inviteGardenRegular(input.id);if(changed && input.action==0){replaced=true;scene->resetTravel();commands.clear();app.resetClocks();}}
                if(command==43)game.welcomeMenu(input.action,int(input.x));
                if (command==25)game.welcome(input.action,input.id,input.rotation,true,int(input.x));
                if (command==26)game.purchaseIngredient(input.id);
                if (command==27)game.restockIngredient(input.id);
                if (command==28) {
                    cafe::sim::WorkerId id{std::uint64_t(input.id),input.id>0?game.runtime->epoch():0};
                    if(input.action==0)game.hire();
                    if(input.action==1)game.dismiss(id);
                    if(input.action==2)game.staffBreak(id);
                    if(input.action==3)game.setPriority(id,input.rotation,int(input.x));
                }
            }
        }
        if(replaced)EM_ASM({window.dispatchEvent(new Event('cafe-session-replaced'));});
        renderer->serviceRecovery();
        if (renderer->ready()) {
            engine::ApplicationFrameCallbacks callbacks;
            callbacks.simulate = [](auto&, const auto& frame) { game.advance(frame.simulation.delta); scene->travel(game); };
            app.advance(emscripten_get_now() / 1000, callbacks);
            scene->project(game);
            renderer->resizeCanvas();
            renderer->render();
        } else app.resetClocks();
        if(audio){
            audio->backend().suspend(paused || app.suspended());
            if(replaced){audio->stopAll();ambienceVoice={};grinderVoice={};workVoices.clear();}
            const auto currentWork=runningCues();
            std::erase_if(workVoices,[&](const auto& v){if(containsWork(currentWork,v.work))return false;audio->stop(v.voice);return true;});
            if(!game.active() && grinderVoice){audio->stop(grinderVoice);grinderVoice={};}
            if(!paused && !app.suspended() && !replaced){
                if(game.served>previousServed){playCue(Cup);playCue(Payment,.75f);}
                if(game.admitted>previousAdmitted)playCue(Door,.7f);
                if(!wasReady && game.ready)playCue(Ready,.55f);
                if(game.order!=previousOrder && game.active() && std::any_of(game.items.begin(),game.items.end(),[](const auto& i){return i.product>=0 && i.product<=2;}))grinderVoice=playCue(Grinder,.65f);
                for(const auto& work:currentWork)if(!containsWork(previousWork,work)){
                    auto voice=playCue(work.cue);if(voice)workVoices.push_back({work,voice});
                }
            }
            if(audio->backend().active() && sounds[Ambience] && !ambienceVoice){engine::AudioPlayOptions options;options.bus=ambienceBus;options.loop=true;ambienceVoice=audio->play(sounds[Ambience],options);if(ambienceVoice)++cueCounts[Ambience];}
            audio->update(0,scene);
            EM_ASM({window.cafeAudioState=({active:!!$0,voices:$1,device:$2,cues:Array.from(HEAPU32.subarray($3/4,$3/4+$4))});},audio->backend().active(),audio->voiceCount(),static_cast<engine::BrowserAudioBackend&>(audio->backend()).deviceId(),cueCounts.data(),cueCounts.size());
        }
        publish();
    } catch (const std::exception& error) {
        app.pause(); paused = true;
        EM_ASM({window.engineStatus(UTF8ToString($0),true);}, error.what());
    }
}
}
extern "C" {
EMSCRIPTEN_KEEPALIVE void cafe_viewport(int width,int height){if(width>0 && height>0 && width<=8192 && height<=8192){uiWidth=width;uiHeight=height;}}
EMSCRIPTEN_KEEPALIVE void cafe_camera(int action,double x,double z){if(hostAlive && scene && action>=0 && action<=5 && std::isfinite(x) && std::isfinite(z))scene->cameraControl(action,float(x),float(z));}
EMSCRIPTEN_KEEPALIVE void cafe_motion(int reduced){if(scene)scene->reducedMotion=reduced!=0;}
EMSCRIPTEN_KEEPALIVE int cafe_model(int id,const std::byte* bytes,int count){return hostAlive && scene && count>0 && std::size_t(count)<=cafe::CafeScene::modelByteLimit(id) && scene->loadModel(id,{bytes,std::size_t(count)});}
EMSCRIPTEN_KEEPALIVE int cafe_sound(int id,const float* samples,int count,int rate){
    if(!hostAlive || id<0 || id>=int(sounds.size()) || !samples || count<=0 || count>(id==Ambience?480000:160000) || rate!=16000)return 0;
    try{auto candidate=engine::SoundAsset::create(rate,1,{samples,std::size_t(count)});sounds[std::size_t(id)]=std::move(candidate);return 1;}catch(const std::exception&){return 0;}
}
EMSCRIPTEN_KEEPALIVE void cafe_audio(int action,double value){
    if(!audio || !std::isfinite(value) || value<0 || value>1)return;
    if(action==0 && !paused && !app.suspended()){audio->backend().suspend(false);audio->backend().activate();}
    if(action==1)audio->setBusMuted(audio->masterBus(),value!=0);
    if(action==2)audio->setBusVolume(effectsBus,float(value));
    if(action==3)audio->setBusVolume(ambienceBus,float(value));
    if(action==4 && !paused && !app.suspended())playCue(Ui,.45f);
    if(action==5 && hostAlive && !paused && !app.suspended())playCue(Appeal,.65f);
}
EMSCRIPTEN_KEEPALIVE void cafe_command(int command) {
    if (((command >= 0 && command <= 24 && command != 16 && command!=20) || command==33 || (command>=40 && command<=42)) && commands.size() < 16){
        commands.push_back({command});
        // Resume the device synchronously in the Resume button's gesture.
        if(command==2 && paused && audio && !app.suspended()){audio->backend().suspend(false);audio->backend().activate();}
    }
}
EMSCRIPTEN_KEEPALIVE void cafe_prepare(int product) {if(product>=0 && product<8 && commands.size()<16)commands.push_back({44,0,product});}
EMSCRIPTEN_KEEPALIVE void cafe_garden_story(int action,int index) {if(action>=0 && action<=3 && index>=0 && index<3 && commands.size()<16)commands.push_back({45,action,index});}
EMSCRIPTEN_KEEPALIVE void cafe_guest(int profile,int first,int second) {
    if(commands.size()<16)commands.push_back({25,profile,first,-1,0,second});
}
EMSCRIPTEN_KEEPALIVE void cafe_guest_seating(int profile,int first,int second,int preference) {
    if(preference>=-1 && preference<=1 && commands.size()<16)commands.push_back({first<0?43:25,profile,first,double(preference),0,second});
}
EMSCRIPTEN_KEEPALIVE void cafe_service(int action,int id) {
    if(action>=0 && action<=2 && id>0 && commands.size()<16)commands.push_back({32,action,id});
}
EMSCRIPTEN_KEEPALIVE void cafe_supply(int action,int ingredient) {
    if((action==0 || action==1) && commands.size()<16)commands.push_back({26+action,0,ingredient});
}
EMSCRIPTEN_KEEPALIVE void cafe_staff(int action,int id,int role,int priority) {
    if(action>=0 && action<=3 && id>=0 && id<=10001 && commands.size()<16)commands.push_back({28,action,id,double(priority),0,role});
}
EMSCRIPTEN_KEEPALIVE void cafe_campaign(int action) {
    if(action>=0 && action<=4 && commands.size()<16)commands.push_back({29,action});
}
EMSCRIPTEN_KEEPALIVE void cafe_clock(int action) {
    if(action==0 && commands.size()<16)commands.push_back({31,action});
}
EMSCRIPTEN_KEEPALIVE void cafe_equipment(int action,int key,double x,double z,int rotation) {
    if(action>=0 && action<=4 && std::isfinite(x) && std::isfinite(z) && (action!=4 || (x>=0 && x<4 && x==std::floor(x))) && commands.size()<16)commands.push_back({30,action,key,x,z,rotation});
}
EMSCRIPTEN_KEEPALIVE void cafe_scenario(int index) {
    if(index>=0 && std::size_t(index)<cafe::scenarios.size() && commands.size()<16)commands.push_back({20,0,index});
}
EMSCRIPTEN_KEEPALIVE void cafe_layout(int action,int id,double x,double z,int rotation) {
    if(commands.size()<16)commands.push_back({16,action,id,x,z,rotation});
}
// Read-only floor picking in normalized canvas coordinates; packed half-metre cell.
EMSCRIPTEN_KEEPALIVE int cafe_service_pick(double x,double y,double aspect) {
    if(!hostAlive || !scene || !std::isfinite(x) || !std::isfinite(y) || !std::isfinite(aspect) ||
       x<0 || x>1 || y<0 || y>1 || aspect<=0)return 0;
    engine::SelectionQuery query;query.geometry=engine::SelectionGeometry::Triangles;query.occlusion=true;
    auto hit=scene->selection().resolvePointer({float(x*aspect),float(y)},scene->camera(),{0,0,float(aspect),1},query);
    if(!hit)return 0;
    auto* actor=scene->findActor(hit->actor);
    return actor->hasTag("prepare-machine")?2:actor->hasTag("prepare-counter")?1:0;
}
EMSCRIPTEN_KEEPALIVE int cafe_floor_pick(double x,double y,double aspect) {
    if(!hostAlive || !scene || !std::isfinite(x) || !std::isfinite(y) || !std::isfinite(aspect) ||
       x<0 || x>1 || y<0 || y>1 || aspect<=0)return -1;
    auto ray=scene->camera().screenPointToRay({float(x*aspect),float(y)},{0,0,float(aspect),1});
    if(ray.direction.y>=-.0001f)return -1;
    auto point=ray.origin+ray.direction*(-ray.origin.y/ray.direction.y);
    if(point.x>=6 && point.x<12 && point.z>=-5 && point.z<5 && game.courtyardOpen())
        return 480+int(std::floor((point.z+5)*2))*12+int(std::floor((point.x-6)*2));
    if(point.x< -6 || point.x>=6 || point.z< -5 || point.z>=5)return -1;
    return int(std::floor((point.z+5)*2))*24+int(std::floor((point.x+6)*2));
}
// Project floor guides with the same camera used for rendering and picking.
EMSCRIPTEN_KEEPALIVE int cafe_staff_pick(double x,double y,double aspect,int select) {
    if(!hostAlive || !scene || !std::isfinite(x) || !std::isfinite(y) || !std::isfinite(aspect) ||
       x<0 || x>1 || y<0 || y>1 || aspect<=0)return 0;
    return int(scene->pickStaff(float(x),float(y),float(aspect),select!=0));
}
EMSCRIPTEN_KEEPALIVE void cafe_staff_move(int cell) {
    if(hostAlive && commands.size()<16)commands.push_back({34,0,cell});
}
EMSCRIPTEN_KEEPALIVE void cafe_staff_deselect() {if(hostAlive && scene)scene->clearStaffSelection();}
EMSCRIPTEN_KEEPALIVE int cafe_floor_project(double x,double z,double aspect,float* output) {
    if(!hostAlive || !scene || !output || !std::isfinite(x) || !std::isfinite(z) || !std::isfinite(aspect) || aspect<=0)return 0;
    auto point=scene->camera().worldToScreen({float(x),.015f,float(z)},{0,0,float(aspect),1});
    if(!point.inFront || !std::isfinite(point.pixel.x) || !std::isfinite(point.pixel.y))return 0;
    output[0]=point.pixel.x/float(aspect);output[1]=point.pixel.y;return 1;
}
EMSCRIPTEN_KEEPALIVE int cafe_layout_preview(int id,double x,double z,int rotation) {
    auto gx=cafe::sim::GridLayout::snap(x,-6,.5),gz=cafe::sim::GridLayout::snap(z,-5,.5);
    if(!gx || !gz)return int(cafe::sim::LayoutError::Invalid);
    if(cafe::garden::outdoorTable(id))return int(game.gardenPreview(id,*gx-24,*gz,rotation));
    auto candidate=game.layout;
    int w=4,d=8;if(id<1 || id>4){auto key=cafe::Simulation::buildKey(id);if(key<=0)return int(cafe::sim::LayoutError::Invalid);w=cafe::Simulation::buildItems[std::size_t(key)].width;d=cafe::Simulation::buildItems[std::size_t(key)].depth;}
    auto error=candidate.find(id)?candidate.move(id,*gx,*gz,rotation):candidate.place({std::uint64_t(id),*gx,*gz,w,d,rotation});
    if(error==cafe::sim::LayoutError::None && !game.validGardenConnection(candidate))error=cafe::sim::LayoutError::Unreachable;
    return int(error);
}
EMSCRIPTEN_KEEPALIVE void cafe_suspend(int hidden) {if(!hostAlive)return;commands.clear(); app.setSuspended(hidden != 0);if(audio)audio->backend().suspend(hidden!=0 || paused); }
EMSCRIPTEN_KEEPALIVE void cafe_shutdown() {if(!hostAlive)return;hostAlive=false;emscripten_cancel_main_loop();audio.reset();app.shutdown(); }
}
int main() {
    try {
#ifdef CAFE_GARDEN_DEVELOPMENT_FIXTURE
        game.contentAccess={true,true};
        EM_ASM({window.cafeGardenDevelopmentFixture=true;});
#endif
        if(EM_ASM_INT({return !!window.EngineAudioDevices;})){
            audio=std::make_unique<engine::AudioSystem>(std::make_unique<engine::BrowserAudioBackend>(),8);
            effectsBus=audio->createBus("Cafe effects");ambienceBus=audio->createBus("Cafe ambience");
            audio->setBusVolume(effectsBus,.55f);audio->setBusVolume(ambienceBus,.3f);
        }
        app.setSceneBinding([](engine::Scene* active) {
            if (!active) { renderer.reset(); scene = nullptr; return; }
            scene = &dynamic_cast<cafe::CafeScene&>(*active);
            renderer = std::make_unique<engine::Renderer>(*scene, scene->camera());
            const int gl = EM_ASM_INT({return new URLSearchParams(location.search).get('backend')==='webgl2';});
            renderer->initialize(gl ? engine::RenderBackendPreference::WebGl2 : engine::RenderBackendPreference::Automatic);
        });
        if(!cafe::startScenario(game,cafe::scenarios[0],false))throw std::runtime_error("Invalid authored content");
        auto content=cafe::authoredContent();EM_ASM({window.cafeContent?.(UTF8ToString($0));},content.c_str());
        app.start(app.loadScene(std::make_unique<cafe::CafeScene>()));
        EM_ASM({window.cafeLoadAssets?.();});
        app.setSuspended(EM_ASM_INT({return document.hidden;}) != 0);
        emscripten_set_main_loop(frame, 0, true);
    } catch (const std::exception& error) {
        EM_ASM({window.engineStatus(UTF8ToString($0),true);}, error.what());
        return 1;
    }
}
