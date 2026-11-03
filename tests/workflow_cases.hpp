#include "engine/simulator/workflow.hpp"
inline void workflowChecks() {
    using namespace engine::simulator;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Workflow line "+std::to_string(at.line()));};
    TaskBoard board(7);WorkerId barista{1,7},cleaner{2,7};
    check(bool(board.addStaff({barista,{"test:brew"},0,1000})));
    check(bool(board.addStaff({cleaner,{"test:clean"}})));
    auto low=board.enqueue({"test:low","test:brew",1,100,{}});check(bool(low));
    auto high=board.enqueue({"test:high","test:brew",20,800,{}});check(bool(high));
    auto next=board.enqueue({"test:next","test:brew",30,0,{high.value}});check(bool(next));
    auto clean=board.enqueue({"test:clean","test:clean",5,200,{}});check(bool(clean));
    check(board.assign(0).value==2);auto task=board.current(barista).value();
    check(task.id==high.value && board.current(cleaner)->id==clean.value);
    check(!board.start(task.id,cleaner,task.token));
    check(bool(board.start(task.id,barista,task.token)));check(!board.complete(task.id,barista,task.token));
    auto stale=task;check(bool(board.advance(300)));check(board.task(high.value)->remaining==500);
    check(bool(board.available(barista,false)));check(board.task(high.value)->state==TaskState::Queued);
    check(bool(board.advance(500)));check(board.task(high.value)->remaining==500);
    check(!board.complete(stale.id,barista,stale.token));
    check(bool(board.available(barista,true)));check(board.assign(500).value==1);
    task=board.current(barista).value();check(task.token!=stale.token);check(bool(board.start(task.id,barista,task.token)));
    check(bool(board.advance(1000)));check(board.task(high.value)->state==TaskState::Completed); // Completion at shift end wins.
    check(board.assign(1000).value==0);check(!board.current(barista));
    check(bool(board.shift(barista,1100,2000)));check(board.assign(1099).value==0);
    check(board.assign(1100).value==1);task=board.current(barista).value();check(task.id==next.value);
    check(bool(board.start(task.id,barista,task.token)));check(bool(board.complete(task.id,barista,task.token)));
    check(bool(board.cancel(low.value)));check(!board.cancel(low.value));
    check(!board.forget(high.value));check(bool(board.forget(next.value)));check(bool(board.forget(high.value)));
    auto parent=board.enqueue({"test:parent","test:brew",1,0,{}});check(bool(parent));
    auto child=board.enqueue({"test:child","test:brew",1,0,{parent.value}});check(bool(child));
    check(bool(board.cancel(parent.value)));check(board.task(child.value)->state==TaskState::Cancelled);
    check(!board.advance(-1));check(!board.enqueue({"test:bad","test:brew",0,0,{{999,7}}}));
    auto snapshot=board.snapshot();auto corrupt=snapshot;corrupt.tasks.back().spec.dependencies={{999,7}};
    check(!board.restore(corrupt));check(board.snapshot().tasks.size()==snapshot.tasks.size());
    corrupt=snapshot;corrupt.tasks[0].worker={1,0};check(!board.restore(corrupt));
    auto active=board.current(cleaner).value();check(bool(board.restore(snapshot)));
    check(!board.start(active.id,cleaner,active.token)); // Restore invalidates arrival.
    TaskBoard tiny(7,1);check(bool(tiny.enqueue({"test:one","test:brew",0,0,{}})));check(!tiny.enqueue({"test:two","test:brew",0,0,{}}));
    TaskBoard partitions(8);WorkerId w{1,8};check(bool(partitions.addStaff({w,{"test:brew"},0,50})));
    auto t=partitions.enqueue({"test:partial","test:brew",0,100,{}});check(bool(t));check(bool(partitions.assign(0)));
    auto running=partitions.current(w).value();check(bool(partitions.start(t.value,w,running.token)));
    check(bool(partitions.advance(100)));check(partitions.task(t.value)->remaining==50 && partitions.task(t.value)->state==TaskState::Queued);
}
inline void cafeWorkflowChecks() {
    using namespace engine::simulator;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Cafe workflow line "+std::to_string(at.line()));};
    cafe::Simulation game;check(welcomeCounterGuest(game) && game.brew(false));
    auto start=[&](cafe::Simulation& session) {
        auto t=session.tasks->current(session.staff);if(!t || t->state!=TaskState::Assigned)return;
        if(t->spec.key=="cafe:prepare") {
            auto j=session.runtime->job(session.runtime->order(session.order).value.jobs[0]).value;
            if(j.state==JobState::Assigned)check(bool(session.runtime->arrive(j.id,j.assignment)));
        }
        check(bool(session.tasks->start(t->id,session.staff,t->token)));
    };
    check(!game.handoverReady());start(game);game.advance(.2);
    auto old=game.tasks->current(game.staff).value();game.takeBreak();game.advance(1);
    check(game.tasks->task(old.id)->remaining==300 && game.stock==100); // Production claims begin after collection.
    check(game.runtime->stock(game.inventory,game.beans).value.total==100);
    auto bytes=game.save();check(game.load(bytes));check(!game.onShift());
    check(!game.tasks->start(old.id,game.staff,old.token));
    game.takeBreak();game.workflowTick();start(game);game.advance(.3);start(game);
    check(game.runtime->stock(game.inventory,game.beans).value.total==99);
    game.advance(3);start(game);check(game.handoverReady());check(game.serve(false));
    auto guest=game.customer;auto seat=game.seats.claim(guest).value();game.seated(guest,seat.point,seat.token);
    game.advance(cafe::Simulation::diningDuration({0,-1})/1000.0);check(game.guest(guest)->cleanup && game.seats.claim(guest));game.departed(guest);start(game);
    game.advance(.4);check(game.guest(guest)->hasDeparted);game.takeBreak();game.advance(2);
    auto cleaning=game.tasks->tasks().front();check(cleaning.remaining==600);
    bytes=game.save();cafe::Simulation restored;restored.immediate=false;check(restored.load(bytes));
    check(restored.save()==bytes && !restored.onShift());restored.takeBreak();restored.workflowTick();start(restored);restored.advance(.6);
    check(restored.seats.claims().empty() && restored.guests.empty() && restored.tasks->tasks().empty());
    check(restored.coins==5 && restored.served==1 && !restored.serve());
    auto unsupported=game.save();unsupported[8]=2;auto keep=restored.save();check(!restored.load(unsupported) && restored.save()==keep);
}
