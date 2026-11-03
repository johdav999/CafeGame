    static constexpr auto profiles=definitions::profiles;
    sim::DemandRandom demandRandom;
    sim::ArrivalTimer arrivals;
    bool automaticGuests=false;
    std::uint64_t admitted=0,missed=0,deliveredReviews=0,failedReviews=0,totalSatisfaction=0,baselineServed=0;
    int lastOutcome=0,lastScore=0,lastProfile=0;
    sim::SatisfactionInputs lastInputs;
    std::uint64_t reviewCount() const {return deliveredReviews+failedReviews;}
    int furnishingReputation() const {
        int bonus=0;
        for(int id=20;id<=23;++id)if(layout.find(id))bonus+=id<=21?10:5;
        return bonus;
    }
    int reputation() const {
        const int reviews=reviewCount()?int(totalSatisfaction/reviewCount()):750;
        return std::min(1000,reviews+furnishingReputation());
    }
    struct Attractiveness {int total,menu,experience,furnishings;};
    // Derived from saved game state; reading the score never advances simulation.
    Attractiveness attractiveness() const {
        int recipes=0;for(int p=0;p<8;++p)if(unlocked(p))++recipes;
        // Ten points for the starter menu; the wider-menu bonus becomes
        // established over the first ten successful visits, including practice.
        int menu=std::min(10,recipes*5)+std::max(0,recipes-2)*5*int(std::min<std::uint64_t>(10,deliveredReviews))/10;
        int waiting=0,count=0;
        for(const auto& g:guests)if(!g.rating && g.phase!=GuestPhase::Leaving) {
            auto score=sim::patienceScore(serviceWait(g),separatePatience(g)?profiles[std::size_t(g.profile)].patience:g.budget);require(score);
            waiting+=score.value;++count;
        }
        // New cafes begin with ten experience points. Reviews build confidence
        // gradually; current waits can reduce the result but never boost it.
        int reviewed=reviewCount()?int((totalSatisfaction/reviewCount()*50+500)/1000):10;
        int experience=10+(reviewed-10)*int(std::min<std::uint64_t>(10,reviewCount()))/10;
        if(count)experience=(experience*(3000+waiting/count)+2000)/4000;
        int furnishings=std::min(20,int(serviceTableCount())*5);
        for(int id=20;id<=23;++id)if(layout.find(id))furnishings+=3;
        if(finish!=0)furnishings+=5;
        furnishings=std::min(25,furnishings);
        return {menu+experience+furnishings,menu,experience,furnishings};
    }
    static constexpr std::size_t maximumVisitors=9;
    static constexpr std::size_t visitorLimitForScore(int score) {return std::size_t(std::clamp(score/10-1,2,9));}
    std::size_t visitorLimit() const {return visitorLimitForScore(attractiveness().total);}
    std::size_t visitingGuests() const {return std::count_if(guests.begin(),guests.end(),[](const auto& g){return !g.hasDeparted;});}
    bool visitorRoom() const {return visitingGuests()<visitorLimit() && guests.size()<maximumVisitors;}
    bool profileRoom(int profile) const {
        if(!visitorRoom())return false;
        if(profiles[std::size_t(profile)].takeaway)return queue.claims().size()+counter.claims().size()<3;
        return serviceTableCount()>0 && seats.claims().size()<serviceTableCount()+maximumTableWaiters;
    }
    std::size_t demandSaveBytes() const {return (18+guests.size()*7)*8;}
    // The existing saved remaining word is a phase timer: table wait, service
    // wait, then consumption after payment. Core deadlines provide a hard upper
    // bound; old saves retain their original single arrival-based patience.
    static constexpr sim::Milliseconds tableWaitBudget=180000;
    bool separatePatience(const Guest& g) const {return g.tableService && g.budget==profiles[std::size_t(g.profile)].patience+tableWaitBudget;}
    sim::Milliseconds guestPatience(const Guest& g) const {
        const auto core=std::max<sim::Milliseconds>(0,runtime->customer(g.id).value.deadline-runtime->time());
        return separatePatience(g) && !g.rating?std::min(core,g.remaining):core;
    }
    sim::Milliseconds patienceBudget(const Guest& g) const {return separatePatience(g)?(g.phase==GuestPhase::ToSeat?tableWaitBudget:profiles[std::size_t(g.profile)].patience):g.budget;}
    sim::Milliseconds serviceWait(const Guest& g) const {return separatePatience(g)?(g.phase==GuestPhase::ToSeat?0:std::max<sim::Milliseconds>(0,profiles[std::size_t(g.profile)].patience-g.remaining)):runtime->time()-g.arrived;}
    sim::SatisfactionInputs satisfactionInputs(const Guest& g) const {
        auto waited=sim::patienceScore(serviceWait(g),separatePatience(g)?profiles[std::size_t(g.profile)].patience:g.budget);require(waited);
        auto product=drink?drink->sample(runtime->time()).value.score:0;
        int dirty=int(std::count_if(guests.begin(),guests.end(),[](const auto& v){return bool(v.cleanup);}));
        int clean=std::min(machineCondition.snapshot().cleanliness,std::max(0,1000-dirty*250));
        bool free=seats.claim(g.id).has_value() || seats.claims().size()<serviceTableCount();
        int fit=profiles[std::size_t(g.profile)].takeaway?1000:free?1000:!serviceTableCount()?300:250;
        return {waited.value,product,clean,fit};
    }
    void recordReview(Guest& g,int outcome,int score,sim::SatisfactionInputs inputs={}) noexcept {
        if(g.rating)return;
        g.rating=outcome;g.score=score;
        campaignReview(g,outcome,score);
        if(outcome==3)return; // Closing/legacy outcomes are neutral.
        if(outcome==1)++deliveredReviews;else ++failedReviews;
        totalSatisfaction+=std::uint64_t(score);lastOutcome=outcome;lastScore=score;lastProfile=g.profile;lastInputs=inputs;
    }
    bool demandDue() {return automaticGuests && !closed && arrivals.remaining==0;}
    static constexpr std::size_t maximumTableWaiters=2;
    std::size_t waitingForTable() const {
        return std::count_if(seats.claims().begin(),seats.claims().end(),[](const auto& claim){return claim.point==Pool::waiting;});
    }
    sim::Milliseconds arrivalBaseInterval() const {return serviceTableCount()<=2?45000:30000;}
    sim::Milliseconds arrivalInterval(std::uint32_t jitter) const {
        // Appeal must increase foot traffic as well as the admission cap. Keep
        // starter pacing, then scale the seeded interval by the unlocked capacity.
        const auto starter=arrivalBaseInterval()-reputation()*10+sim::Milliseconds(jitter);
        return std::max<sim::Milliseconds>(6000,starter*2/sim::Milliseconds(visitorLimit()));
    }
    void demandArrival() {
        auto next=demandRandom;
        bool room=visitorRoom() && admitted<8000000;
        int profile=0,regular=-1;
        if(room){auto choice=next.uniform(3);require(choice);profile=int(choice.value);}
        if(room && campaign.enabled) {
            auto choice=next.uniform(6);require(choice);
            if(choice.value<3 && std::none_of(guests.begin(),guests.end(),[&](const auto& g){return g.regular==int(choice.value);})) {regular=int(choice.value);profile=regular;}
        }
        // Invite one not-yet-seen garden neighbor per arrival, in a stable
        // order. The ordinary bounded table/queue checks still own admission.
        if(room && gardenStory.started && (gardenStory.chapters&4))for(int n=0;n<3;++n)
            if(gardenStory.regulars[std::size_t(n)].lastDay!=campaign.day && recipeReason(gardenStory.regulars[std::size_t(n)].preference).empty()) {regular=n+3;profile=gardenRegularProfiles[std::size_t(n)];break;}
        // Reserve at most two places outside the occupied/reserved table seats.
        // Takeaway traffic uses the existing independent three-person counter queue.
        if(room && !profileRoom(profile))room=false;
        auto jitter=next.uniform(10001);require(jitter);
        if(room && !(regular>=3?welcome(profile,gardenStory.regulars[std::size_t(regular-3)].preference,-1,true,1):welcomeMenu(profile))){room=false;next=demandRandom;jitter=next.uniform(10001);require(jitter);}
        if(room && regular>=0){auto& g=guests.back();g.regular=regular;auto& r=regular<3?campaign.regulars[std::size_t(regular)]:gardenStory.regulars[std::size_t(regular-3)];++r.visits;r.lastDay=campaign.day;}
        if(!room && missed<1000000000)++missed;
        require(arrivals.restore(arrivalInterval(jitter.value)));demandRandom=next;
    }
    template<class Put> void saveDemand(Put put) const {
        auto random=demandRandom.snapshot();put(random.value);put(random.draws);put(automaticGuests);put(arrivals.remaining);
        put(admitted);put(missed);put(deliveredReviews);put(failedReviews);put(totalSatisfaction);put(baselineServed);
        put(lastOutcome);put(lastScore);put(lastProfile);put(lastInputs.wait);put(lastInputs.product);put(lastInputs.cleanliness);put(lastInputs.preference);
        put(guests.size());for(const auto& g:guests){put(g.id.value);put(g.profile);put(g.arrived);put(g.budget);put(g.rating);put(g.score);put(g.legacyPatience);}
    }
    template<class Get> bool loadDemand(Get get,bool allowLegacyPatience=false) {
        auto value=get(),draws=get(),automatic=get(),remaining=get();
        if(value>UINT32_MAX || automatic>1 || remaining>sim::ArrivalTimer::maximum ||
           !demandRandom.restore({std::uint32_t(value),draws}) || !arrivals.restore(std::int64_t(remaining)))return false;
        automaticGuests=bool(automatic);admitted=get();missed=get();deliveredReviews=get();failedReviews=get();totalSatisfaction=get();baselineServed=get();
        if(admitted>8000000 || missed>1000000000 || deliveredReviews>admitted || failedReviews>admitted-deliveredReviews ||
           totalSatisfaction>deliveredReviews*1000 || baselineServed>std::uint64_t(served) || baselineServed+deliveredReviews!=std::uint64_t(served))return false;
        auto outcome=get(),score=get(),profile=get(),wait=get(),product=get(),clean=get(),fit=get();
        if(outcome>2 || score>1000 || profile>2 || wait>1000 || product>1000 || clean>1000 || fit>1000)return false;
        lastOutcome=int(outcome);lastScore=int(score);lastProfile=int(profile);lastInputs={int(wait),int(product),int(clean),int(fit)};
        if(bool(outcome)!=bool(reviewCount()) || (!outcome && (score || profile || wait || product || clean || fit)) ||
           (outcome==2 && (score || wait || product || clean || fit)))return false;
        if(outcome==1){auto expected=sim::satisfaction(lastInputs,profiles[std::size_t(profile)].weights);if(!expected || expected.value!=lastScore || !deliveredReviews)return false;}
        if(outcome==2 && !failedReviews)return false;
        auto n=get();if(n!=guests.size() || n>admitted)return false;
        std::uint64_t liveDelivered=0,liveFailed=0,liveTotal=0,neutralServed=0;
        for(auto& g:guests) {
            auto id=get(),p=get(),at=get(),budget=get(),rating=get(),result=get(),reserved=get();
            if(p>2 || reserved>1 || (reserved && (!allowLegacyPatience || p!=0)))return false;
            auto expectedBudget=reserved?60000:profiles[std::size_t(p)].patience;
            if(id!=g.id.value || at>std::uint64_t(runtime->time()) || (budget!=std::uint64_t(expectedBudget) && !(g.tableService && !reserved && budget==std::uint64_t(expectedBudget+tableWaitBudget))) || rating>3 || result>1000)return false;
            g.legacyPatience=bool(reserved);
            auto c=runtime->customer(g.id);if(!c || at>UINT64_MAX-budget || at+budget!=std::uint64_t(c.value.deadline))return false;
            bool servedGuest=c.value.state==sim::CustomerState::Served;
            bool departedGuest=c.value.state==sim::CustomerState::Departed;
            if((!servedGuest && !departedGuest && rating) || (servedGuest && rating!=1 && rating!=3) ||
               (departedGuest && rating!=2 && rating!=3) || (rating!=1 && result))return false;
            g.profile=int(p);g.arrived=std::int64_t(at);g.budget=std::int64_t(budget);g.rating=int(rating);g.score=int(result);
            liveDelivered+=rating==1;liveFailed+=rating==2;liveTotal+=result;neutralServed+=servedGuest && rating==3;
        }
        return liveDelivered<=deliveredReviews && liveFailed<=failedReviews && liveTotal<=totalSatisfaction && neutralServed<=baselineServed;
    }
    void migrateDemand(std::uint64_t sourceSchema) {
        baselineServed=std::uint64_t(served);admitted=guests.size();
        for(auto& g:guests) {
            auto c=runtime->customer(g.id).value;
            auto budget=((sourceSchema==1 || c.deadline<120000) && c.deadline>=60000 && c.deadline-60000<=runtime->time())?60000:120000;
            if(c.deadline<budget || c.deadline-budget>runtime->time())throw std::runtime_error("Invalid legacy patience");
            g.arrived=c.deadline-budget;g.budget=budget;g.legacyPatience=budget==60000;
            if(c.state==sim::CustomerState::Served || c.state==sim::CustomerState::Departed)g.rating=3;
        }
    }
