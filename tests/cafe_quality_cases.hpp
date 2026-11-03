#pragma once
#include "previous_guest_envelope.hpp"
inline void cafeQualityChecks() {
    using namespace engine::simulator;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe quality line "+std::to_string(at.line()));};
    cafe::Simulation game{20,5000};using Care=cafe::Simulation::Maintenance;
    auto initial=game.save();check(!game.requestMaintenance(Care(99)) && game.save()==initial);
    check(welcomeCounterGuest(game) && game.brew());check(game.machineCondition.snapshot().uses==1 && game.machineCondition.snapshot().integrity==900);
    game.advance(3);check(game.ready && game.drink->sample(game.runtime->time()).value.score==1000);
    check(game.runtime->remove(game.inventory,std::array{Amount{game.coffee,1}}).error==Error::InsufficientStock);
    auto fresh=game.save();cafe::Simulation loaded;check(loaded.load(fresh) && loaded.save()==fresh);
    loaded.advance(44.999);check(loaded.ready);auto almost=loaded.save();check(loaded.load(almost));loaded.advance(.001);
    check(!loaded.ready && loaded.wasted==1 && loaded.wallet==5000 && loaded.runtime->stock(loaded.inventory,loaded.coffee).value.total==0);
    check(!loaded.serve() && loaded.machineCondition.snapshot().uses==1);loaded.advance(1);check(loaded.wasted==1);
    check(game.serve());check(game.requestMaintenance(Care::Clean) && !game.brew());game.advance(1);
    game.takeBreak();auto paused=game.save();check(loaded.load(paused));check(loaded.maintenance==Care::Clean);
    auto work=loaded.tasks->task(loaded.maintenanceTask).value();check(work.remaining==1000);loaded.advance(10);check(loaded.tasks->task(loaded.maintenanceTask)->remaining==1000);
    loaded.takeBreak();loaded.workflowTick();loaded.advance(1);check(!loaded.maintenanceTask && loaded.machineCondition.snapshot().cleanliness==1000);
    check(loaded.machineCondition.snapshot().integrity==900);
    auto cash=loaded.wallet;check(loaded.requestMaintenance(Care::Repair) && loaded.wallet==cash-500);
    auto repairing=loaded.save();check(loaded.cancelMaintenance() && loaded.wallet==cash);check(!loaded.cancelMaintenance());
    check(loaded.load(repairing) && loaded.wallet==cash-500);loaded.advance(4);
    check(!loaded.maintenanceTask && loaded.machineCondition.snapshot().integrity==1000 && loaded.wallet==cash-500);
    auto complete=loaded.save();check(loaded.load(complete) && !loaded.cancelMaintenance() && loaded.wallet==cash-500);
    cafe::Simulation poor{4,0};check(bool(poor.machineCondition.restore({500,500,0,0})));
    auto before=poor.save();check(!poor.requestMaintenance(Care::Repair) && poor.save()==before);
    check(poor.requestMaintenance(Care::Clean));poor.advance(2);check(poor.machineCondition.snapshot().cleanliness==1000);
    cafe::Simulation worn{4,5000};check(bool(worn.machineCondition.restore({199,1000,0,0})));check(!worn.brew());
    check(worn.requestMaintenance(Care::Repair));worn.advance(4);check(worn.brew());worn.advance(3);check(worn.serve());
    cafe::Simulation dirty{4,5000};check(bool(dirty.machineCondition.restore({1000,199,0,0})));check(!dirty.brew());
    check(dirty.requestMaintenance(Care::Clean));dirty.advance(2);check(dirty.brew());dirty.advance(3);check(dirty.cancel() && dirty.wasted==1);
    cafe::Simulation queued{20,5000};check(queued.brew());queued.advance(3);check(queued.ready);
    auto queuedCash=queued.wallet;check(queued.requestMaintenance(Care::Repair));
    check(queued.maintenanceQueued() && !queued.maintenanceTask && queued.wallet==queuedCash);
    auto queueSave=queued.save();cafe::Simulation queueLoaded;check(queueLoaded.load(queueSave));
    check(queueLoaded.maintenanceQueued() && queueLoaded.ready && queueLoaded.cancelMaintenance());
    check(queueLoaded.wallet==queuedCash && !queueLoaded.maintenanceQueued());
    check(queued.serve());queued.advance(.001);check(queued.maintenanceTask && queued.wallet==queuedCash+500-500);
    queued.advance(4);check(!queued.maintenanceTask && queued.machineCondition.snapshot().integrity==1000);
    cafe::Simulation threshold;check(bool(threshold.machineCondition.restore({200,200,0,0})));
    check(threshold.machineUsable());check(bool(threshold.machineCondition.restore({199,199,0,0})));check(!threshold.machineUsable());
    cafe::Simulation completedState;check(completedState.load(complete));
    auto previous=withoutTableGuestFields(completedState);auto oldContent=cafe::contentForRules(6,6);
    auto journalOffset=previous.size()-cafe::compatibilitySaveBytes-cafe::Simulation::journalSaveBytes;
    previous.erase(previous.begin()+journalOffset,previous.begin()+journalOffset+cafe::Simulation::journalSaveBytes);
    auto scheduleOffset=previous.size()-cafe::compatibilitySaveBytes-8-cafe::Simulation::scheduleSaveBytes;
    previous.erase(previous.begin()+scheduleOffset,previous.begin()+scheduleOffset+cafe::Simulation::scheduleSaveBytes);previous[8]=15;
    for(int n=0;n<8;++n){previous[previous.size()-16+n]=std::uint8_t(std::uint64_t(oldContent.version)>>(n*8));previous[previous.size()-8+n]=std::uint8_t(oldContent.fingerprint>>(n*8));}
    check(cafe::inspectSave(previous).migrated);cafe::Simulation oldLoaded;check(oldLoaded.load(previous));
    auto corrupted=complete;corrupted.pop_back();before=loaded.save();check(!loaded.load(corrupted) && loaded.save()==before);
    // Old content rejects without applying retroactive wear or freshness.
    auto prior=legacySave(game);auto preserved=loaded.save();check(!loaded.load(prior) && loaded.save()==preserved);
    // Host arrival before the production start is still guarded by the core.
    cafe::Simulation moving;moving.immediate=false;check(moving.welcome(1) && moving.brew(false));check(moving.machineCondition.snapshot().uses==0);
    auto j=moving.runtime->job(moving.runtime->order(moving.order).value.jobs[0]).value;
    check(j.state==JobState::Queued && !moving.runtime->arrive(j.id,j.assignment));
    auto collect=moving.tasks->current(moving.staff).value();check(bool(moving.tasks->start(collect.id,moving.staff,collect.token)));moving.advance(.5);
    j=moving.runtime->job(j.id).value;
    check(bool(moving.runtime->arrive(j.id,j.assignment)));moving.refresh();check(moving.machineCondition.snapshot().uses==1);
    moving.refresh();check(moving.machineCondition.snapshot().uses==1);
}
