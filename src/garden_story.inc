    enum class GardenParty : std::uint64_t {None,Prepared,Running,Failed,Complete};
    struct GardenStory {
        bool started=false,summerLegacy=false;
        std::uint64_t chapters=0,outdoorServed=0,summerMask=0,metMask=0;
        GardenParty party=GardenParty::None;
        std::uint64_t attempts=0,partyDay=0;
        std::array<std::uint64_t,3> baseline{};
        std::uint64_t partyServed=0,partyScore=0;
        bool fullParty=false;
        std::array<Regular,3> regulars{{{6},{5},{7}}};
    } gardenStory;
    static constexpr std::size_t gardenStorySaveBytes=32*8;
    static constexpr std::int64_t gardenChapterReward=1000;
    static constexpr std::uint64_t partyTarget=6,partyQuality=650;
    static constexpr std::array<const char*,3> gardenRegularNames{"Astrid","Otto","Liv"};
    static constexpr std::array<int,3> gardenRegularProfiles{0,2,0};
    static constexpr std::array<const char*,3> gardenRegularRoles{"Neighborhood gardener","Morning dog walker","Book-club organizer"};
    static constexpr std::array<const char*,3> gardenRegularStories{
        "Astrid tends the neighborhood planters. A glass of lemonade makes the courtyard her afternoon stop.",
        "Otto takes the long route home after his morning walk. He likes an iced coffee and a quiet outdoor seat.",
        "Liv brings a book and recommends a berry-cake slice to her neighbors. Book-club visits use individual tables."};
    static constexpr std::array<const char*,3> gardenRegularFollowups{
        "Astrid is bringing neighbors over after tending the planters. She hopes the courtyard can host them all.",
        "Otto has made this his regular stop. He offers to spread the word about the garden party on his morning route.",
        "Liv tells her book club about the cafe. Everyone will order and sit as an individual guest at the party."};
    static constexpr std::array<const char*,3> gardenRegularEndings{
        "Astrid calls the restored courtyard a little neighborhood landmark. There will always be a place for lemonade here.",
        "Otto still takes the long route home. The party has made this courtyard part of his daily walk.",
        "Liv's neighbors have found their new reading spot. She will keep returning for berry cake and another chapter."};
    static constexpr std::array<const char*,5> gardenChapterNames{
        "Open the courtyard","A table in the sunshine","Summer on the menu","Meet the neighbors","The neighborhood garden party"};
    const char* regularName(int id) const {return id<0?"":id<3?regularNames[std::size_t(id)]:id<6?gardenRegularNames[std::size_t(id-3)]:"";}
    std::string gardenStartReason() const {
        if(!contentAccess.available())return "Garden Cafe must be installed and owned.";
        if(gardenStory.started)return "Garden restoration has already started.";
        if(!campaign.enabled || campaign.phase!=DayPhase::Preparation || !layoutEditable())return "Start during a drained campaign preparation day.";
        if(!(campaign.goals&1))return "Complete first paid service in the base campaign, then prepare the next day.";
        return {};
    }
    bool startGardenRestoration() {
        if(!gardenStartReason().empty())return false;
        Simulation next;next.contentAccess=contentAccess;if(!next.load(save()))return false;
        if(!next.gardenState.selected && !next.selectGarden())return false;
        next.gardenStory.summerLegacy=next.summerProgress();next.gardenStory.started=true;next.campaign.checkpoint.clear();next.gardenStoryTick();
        return load(next.save());
    }
    std::string gardenInviteReason(int index) const {
        if(index<0 || index>=3)return "Choose a garden regular.";
        if(!gardenStory.started || !(gardenStory.chapters&4))return "Complete Summer on the menu to invite the garden regulars.";
        if(campaign.phase!=DayPhase::Open || closed)return "Open service before inviting a regular.";
        if(gardenStory.regulars[std::size_t(index)].lastDay==campaign.day)return "This regular has already visited today. Try again tomorrow.";
        const auto& r=gardenStory.regulars[std::size_t(index)];auto recipe=recipeReason(r.preference);if(!recipe.empty())return recipe;
        if(!profileRoom(gardenRegularProfiles[std::size_t(index)]))return "Wait for an available table or a place in the bounded arrival queue.";
        return {};
    }
    bool inviteGardenRegular(int index) {
        if(!gardenInviteReason(index).empty())return false;
        auto& r=gardenStory.regulars[std::size_t(index)];
        if(!welcome(gardenRegularProfiles[std::size_t(index)],r.preference,-1,true,1))return false;
        guests.back().regular=index+3;++r.visits;r.lastDay=campaign.day;return true;
    }
    void gardenReview(const Guest& g,int outcome,int score) {
        if(!gardenStory.started || !campaign.enabled)return;
        if(outcome==1){
            if(auto seat=seats.claim(g.id);seat && seat->point>=4 && seat->point<6)++gardenStory.outdoorServed;
            for(int p:g.items)if(p>=5)gardenStory.summerMask|=std::uint64_t(1)<<(p-5);
        }
        if(g.regular>=3 && g.regular<6 && outcome!=3){
            auto n=std::size_t(g.regular-3);auto& r=gardenStory.regulars[n];++r.reviews;r.satisfaction+=std::uint64_t(score);r.lastScore=score;
            if(outcome==1)gardenStory.metMask|=std::uint64_t(1)<<n;
        }
    }
    void gardenStoryTick() {
        if(!gardenStory.started)return;
        std::array<bool,5> completed{courtyardOpen(),gardenStory.outdoorServed>0,bool(coldStation) && gardenStory.summerMask==7,gardenStory.metMask==7,gardenStory.party==GardenParty::Complete};
        for(std::size_t n=0;n<5;++n){
            const auto prefix=(std::uint64_t(1)<<n)-1;
            if(gardenStory.chapters!=prefix || !completed[n])continue;
            require(ledger->post("garden:chapters",n+1,gardenChapterReward,runtime->time()));gardenStory.chapters|=std::uint64_t(1)<<n;syncCash();
        }
    }
    std::string gardenPartyReason(bool opening=false) const {
        if(!gardenStory.started || (gardenStory.chapters&15)!=15)return "Complete the first four garden chapters.";
        if(gardenStory.chapters&16)return "The garden party is complete. Continue running your neighborhood cafe.";
        if(campaign.phase!=DayPhase::Preparation || !layoutEditable())return "Prepare the party between days, after visits, tasks and deliveries drain.";
        if(gardenStory.party==GardenParty::Prepared && !opening)return "The party is prepared. Open the day when ready.";
        if(gardenStory.attempts>=365)return "Party attempt limit reached.";
        if(!courtyardOpen() || !gardenLayout.placements().size())return "Install at least one outdoor table (6.00).";
        if(!coldStation)return "Install the cold station (40.00; resale 20.00).";
        if(crew.size()<2)return "Hire a second employee (15.00) for shared service.";
        if(std::count_if(crew.begin(),crew.end(),[&](const auto& w){return onShift(w.id) && std::all_of(w.priorities.begin(),w.priorities.end(),[](auto p){return p>0;});})<2)return "Resume two staff and enable all their service roles.";
        auto condition=machineCondition.snapshot();if(condition.integrity<600 || condition.cleanliness<600)return "Repair and clean the machine to at least 60%.";
        // Readily usable working stock prevents a prepared party from starting
        // behind a delivery or an unfulfilled storage-to-counter transfer.
        for(auto [n,amount]:std::array<std::pair<std::size_t,sim::Quantity>,5>{{{0,6},{1,6},{5,6},{6,3},{7,3}}})
            if(runtime->stock(inventory,ingredient(n)).value.available()<amount)return "Restock "+std::to_string(amount)+" working portions of "+definitions::ingredients[n].name+" before the party.";
        return {};
    }
    bool prepareGardenParty() {
        if(!gardenPartyReason().empty())return false;
        gardenStory.party=GardenParty::Prepared;gardenStory.partyDay=0;gardenStory.baseline={};gardenStory.partyServed=0;gardenStory.partyScore=0;gardenStory.fullParty=false;return true;
    }
    bool cancelGardenParty() {
        if(campaign.phase!=DayPhase::Preparation || gardenStory.party!=GardenParty::Prepared)return false;
        gardenStory.party=gardenStory.attempts?GardenParty::Failed:GardenParty::None;gardenStory.partyDay=0;return true;
    }
    void gardenOpening() {
        if(gardenStory.party!=GardenParty::Prepared)return;
        gardenStory.party=GardenParty::Running;++gardenStory.attempts;gardenStory.partyDay=campaign.day;
        gardenStory.baseline={std::uint64_t(served),deliveredReviews,totalSatisfaction};
    }
    void gardenClosing() {
        if(gardenStory.party!=GardenParty::Running)return;
        gardenStory.partyServed=std::uint64_t(served)-gardenStory.baseline[0];
        auto reviews=deliveredReviews-gardenStory.baseline[1];gardenStory.partyScore=reviews?(totalSatisfaction-gardenStory.baseline[2])/reviews:0;
        gardenStory.fullParty=schedule.elapsed>=shiftLength;
        gardenStory.party=gardenStory.fullParty && gardenStory.partyServed>=partyTarget && gardenStory.partyScore>=partyQuality?GardenParty::Complete:GardenParty::Failed;
    }
    template<class Put> void saveGardenStory(Put put) const {
        // Start mode: 0 absent, 1 new restoration, 2 continuation of an already
        // unlocked G4 summer cafe. Migrated recipes are never taken away.
        const auto& s=gardenStory;put(s.started?(s.summerLegacy?2:1):0);put(s.chapters);put(s.outdoorServed);put(s.summerMask);put(s.metMask);put(std::uint64_t(s.party));put(s.attempts);put(s.partyDay);
        for(auto n:s.baseline)put(n);put(s.partyServed);put(s.partyScore);put(s.fullParty);
        for(const auto& r:s.regulars){put(r.preference);put(r.visits);put(r.reviews);put(r.satisfaction);put(r.lastDay);put(r.lastScore);}
    }
    template<class Get> bool loadGardenStory(Get get) {
        auto started=get();if(started>2)return false;auto& s=gardenStory;s.started=bool(started);s.summerLegacy=started==2;
        s.chapters=get();s.outdoorServed=get();s.summerMask=get();s.metMask=get();auto party=get();s.attempts=get();s.partyDay=get();
        for(auto& n:s.baseline)n=get();s.partyServed=get();s.partyScore=get();auto full=get();if(full>1 || party>4)return false;s.fullParty=bool(full);s.party=GardenParty(party);
        for(std::size_t n=0;n<3;++n){auto p=get(),v=get(),r=get(),score=get(),day=get(),last=get();
            if(p!=std::array{6u,5u,7u}[n] || v>admitted || r>v || score>r*1000 || day>campaign.day || bool(v)!=bool(day) || last>1000 || (!r && last))return false;
            s.regulars[n]={int(p),v,r,score,day,int(last)};
        }
        return true;
    }
    bool validGardenStory() const {
        const auto& s=gardenStory;
        if(s.chapters>31 || (s.chapters&(s.chapters+1)) || s.summerMask>7 || s.metMask>7 || s.outdoorServed>deliveredReviews || s.attempts>365 || s.attempts>campaign.day || s.partyDay>campaign.day || s.partyServed>std::uint64_t(served) || s.partyScore>1000)return false;
        if(s.baseline[0]>std::uint64_t(served) || s.baseline[1]>deliveredReviews || s.baseline[2]>totalSatisfaction)return false;
        if(s.started && (!campaign.enabled || !gardenState.selected || !(campaign.goals&1)))return false;
        if(s.summerLegacy && (!courtyardOpen() || (campaign.goals&3)!=3))return false;
        std::uint64_t visits=0,reviews=0,scores=0;std::array<bool,3> present{};
        for(std::size_t n=0;n<3;++n){const auto& r=s.regulars[n];visits+=r.visits;reviews+=r.reviews;scores+=r.satisfaction;if((s.metMask&(1u<<n)) && (!r.reviews || !r.satisfaction))return false;}
        const auto gardenVisits=visits;
        for(const auto& r:campaign.regulars){visits+=r.visits;reviews+=r.reviews;scores+=r.satisfaction;}
        if(visits>admitted || reviews>reviewCount() || scores>totalSatisfaction)return false;
        for(const auto& g:guests)if(g.regular>=3){auto n=std::size_t(g.regular-3);if(n>=3 || !s.started || !(s.chapters&4) || present[n] || !s.regulars[n].visits || s.regulars[n].lastDay!=campaign.day || g.profile!=gardenRegularProfiles[n] || g.items[0]!=s.regulars[n].preference || (g.rating && g.rating!=3 && !s.regulars[n].reviews))return false;present[n]=true;}
        if(!s.started && (s.chapters || s.outdoorServed || s.summerMask || s.metMask || s.party!=GardenParty::None || s.attempts || s.partyDay || s.baseline!=std::array<std::uint64_t,3>{} || s.partyServed || s.partyScore || s.fullParty || gardenVisits))return false;
        if((s.chapters&1) && !courtyardOpen())return false;
        if((s.chapters&2) && !s.outdoorServed)return false;
        if((s.chapters&4) && s.summerMask!=7)return false;
        if((s.chapters&8) && s.metMask!=7)return false;
        if((s.party!=GardenParty::None) && (s.chapters&15)!=15)return false;
        if(s.party==GardenParty::Prepared && (campaign.phase!=DayPhase::Preparation || s.partyDay || s.partyServed || s.partyScore || s.fullParty || s.baseline!=std::array<std::uint64_t,3>{}))return false;
        if(s.party==GardenParty::Running && (!s.attempts || s.partyDay!=campaign.day || (campaign.phase!=DayPhase::Open && campaign.phase!=DayPhase::Closing) || s.partyServed || s.partyScore || s.fullParty))return false;
        if(s.party==GardenParty::None && (s.attempts || s.partyDay))return false;
        if((s.party==GardenParty::Failed || s.party==GardenParty::Complete) && !s.attempts)return false;
        if(bool(s.chapters&16)!=(s.party==GardenParty::Complete))return false;
        if(s.party==GardenParty::Complete && (!s.fullParty || s.partyServed<partyTarget || s.partyScore<partyQuality))return false;
        if(ledger->sequence("garden:chapters")!=std::uint64_t(std::popcount(s.chapters)) || credited("garden:chapters")!=std::popcount(s.chapters)*gardenChapterReward || debited("garden:chapters"))return false;
        if(finish==3 && !(s.chapters&4))return false;
        if(!campaign.checkpoint.empty()){
            Simulation start;start.contentAccess=contentAccess;if(!start.load(campaign.checkpoint,true))return false;
            const auto& before=start.gardenStory;
            if(before.started!=s.started || before.summerLegacy!=s.summerLegacy || (before.chapters&s.chapters)!=before.chapters || before.outdoorServed>s.outdoorServed || (before.summerMask&s.summerMask)!=before.summerMask || (before.metMask&s.metMask)!=before.metMask || before.attempts>s.attempts)return false;
            for(std::size_t n=0;n<3;++n)if(before.regulars[n].visits>s.regulars[n].visits || before.regulars[n].reviews>s.regulars[n].reviews || before.regulars[n].satisfaction>s.regulars[n].satisfaction)return false;
            if(before.party==GardenParty::Prepared){
                if(campaign.phase==DayPhase::Preparation){if(s.party!=GardenParty::Prepared || s.attempts!=before.attempts)return false;}
                else if(s.attempts!=before.attempts+1 || s.partyDay!=campaign.day || s.party==GardenParty::Prepared || s.party==GardenParty::None)return false;
            }
        }
        return true;
    }
