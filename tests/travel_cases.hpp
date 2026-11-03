#include "engine/simulator/travel.hpp"
inline void travelChecks() {
    using namespace engine::simulator;
    auto check=[](bool ok,std::source_location at=std::source_location::current()){if(!ok)throw std::runtime_error("Travel line "+std::to_string(at.line()));};
    cafe::Simulation s;check(s.welcome(1) && s.brew(false));
    auto collect=[&](){auto t=s.tasks->current(s.staff).value();check(t.spec.key=="cafe:collect");check(bool(s.tasks->start(t.id,s.staff,t.token)));s.advance(.5);};
    collect(); // Production is assigned only after staffed collection finishes.
    auto id=s.runtime->order(s.order).value.jobs[0];
    TravelBinding binding;
    auto ticket=binding.begin(*s.runtime,id);check(bool(ticket));
    s.advance(1);check(s.jobState==int(JobState::Assigned));
    check(s.runtime->stock(s.inventory,s.beans).value.total==100);
    auto saved=s.save();check(s.load(saved));
    check(!binding.complete(*s.runtime,ticket.value,true)); // Pre-load response is stale.
    id=s.runtime->order(s.order).value.jobs[0];
    check(!binding.reconcile(*s.runtime));
    ticket=binding.begin(*s.runtime,id);check(bool(ticket));
    auto stale=ticket.value;binding.clear();
    ticket=binding.begin(*s.runtime,id);check(bool(ticket));
    check(!binding.complete(*s.runtime,stale,true)); // Same assignment, new host request.
    check(bool(binding.complete(*s.runtime,ticket.value,true)));
    check(!binding.complete(*s.runtime,ticket.value,true));
    auto prep=s.tasks->current(s.staff).value();check(bool(s.tasks->start(prep.id,s.staff,prep.token)));
    s.advance(3);check(s.ready && s.stock==99);
    auto handover=s.tasks->current(s.staff).value();check(bool(s.tasks->start(handover.id,s.staff,handover.token)));
    check(s.serve() && s.coins==5);
    check(s.welcome(1) && s.brew(false));collect();id=s.runtime->order(s.order).value.jobs[0];
    ticket=binding.begin(*s.runtime,id);check(bool(ticket));
    check(bool(binding.complete(*s.runtime,ticket.value,false)));s.refresh();
    check(s.jobState==int(JobState::Failed) && s.stock==99 && s.outputHeld==0);
    check(s.welcome(1) && s.brew(false));collect();id=s.runtime->order(s.order).value.jobs[0];
    ticket=binding.begin(*s.runtime,id);check(bool(ticket));check(s.cancel());
    check(!binding.reconcile(*s.runtime));check(!binding.complete(*s.runtime,ticket.value,true));
    check(s.stock==99 && s.outputHeld==0);
}
