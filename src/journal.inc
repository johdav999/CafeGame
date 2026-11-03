    // Campaign-owned journal. Counters record delivered tickets exactly once at
    // recordReview; the day checkpoint includes progress and reward receipts.
    struct Journal {
        bool eligible=true;
        std::uint64_t days=0,profitable=0,wasteFree=0,claims=0,achievements=0,newAchievements=0,daily=0,settled=0;
        // Five products, happy visits, three happy regulars, mixed tickets, tickets.
        std::array<std::uint64_t,11> counts{},baseline{};
    } journal;
    static constexpr std::size_t journalSaveBytes=31*8;
    static constexpr std::int64_t dailyReward=200,achievementReward=500;
    struct JournalGoal {const char* name;const char* description;std::uint64_t target;};
    static constexpr std::array<JournalGoal,9> dailyGoals{{
        {"A good morning","Serve 3 tickets today.",3},
        {"Coffee and company","Serve 2 tickets containing two different items today.",2},
        {"Finding your rhythm","Serve 5 tickets today.",5},
        {"Happy faces","Serve 3 visits with at least 80% satisfaction today.",3},
        {"A little variety","Serve 3 different base menu items today.",3},
        {"The usual","Serve a named regular with at least 80% satisfaction today.",1},
        {"Just enough","Finish a full shift with at least 3 tickets and no discarded items.",1},
        {"Ready for tomorrow","Finish a full shift with at least 3 tickets and a clean machine.",1},
        {"In the black","Finish a full shift with at least 3 tickets and positive operating profit.",1}
    }};
    static constexpr std::array<JournalGoal,18> lifetimeGoals{{
        {"Opening your doors","Complete a full shift and serve at least one ticket.",1},
        {"A week of mornings","Complete 7 full shifts with at least one ticket each.",7},
        {"Part of the neighborhood","Complete 30 full shifts with service.",30},
        {"Getting the hang of it","Serve 25 tickets.",25},
        {"A hundred welcomes","Serve 100 tickets.",100},
        {"The busy little cafe","Serve 500 tickets.",500},
        {"Better together","Serve 25 tickets with two different items.",25},
        {"Espresso yourself","Serve 50 espressos.",50},
        {"Breakfast favorite","Serve 50 croissants.",50},
        {"Something for everyone","Unlock all 5 recipes.",5},
        {"A good morning, indeed","Serve 50 visits with at least 80% satisfaction.",50},
        {"Familiar faces","Satisfy Maja, Leo and Nora on 5 visits each (at least 80%).",15},
        {"Finding your feet","Finish 5 profitable full shifts with service.",5},
        {"Waste not","Finish 10 full shifts with service and no discarded items.",10},
        {"A helping hand","Finish a day with at least 2 employees.",2},
        {"Make yourself at home","Finish a day with a purchased plant and lamp installed.",2},
        {"Room for company","Finish a day with all 4 tables installed.",4},
        {"Tools of the trade","Finish a day with the speed kit, extra station and storage.",3}
    }};
    std::array<std::size_t,3> dailySelection() const {
        auto day=campaign.day-1;
        return {std::size_t(day%3),3+std::size_t((day+day/3)%3),6+std::size_t((day+day/9)%3)};
    }
    void journalReview(const Guest& g,int outcome,int score) noexcept {
        if(!campaign.enabled || outcome!=1)return;
        ++journal.counts[10];
        for(int p:g.items)if(p>=0 && p<5)++journal.counts[std::size_t(p)];
        if(g.items[1]>=0)++journal.counts[9];
        if(score>=800){++journal.counts[5];if(g.regular>=0 && g.regular<3)++journal.counts[6+std::size_t(g.regular)];}
    }
    std::uint64_t dailyProgress(std::size_t id) const {
        auto delta=[&](std::size_t n){return journal.counts[n]-journal.baseline[n];};
        if(id==0 || id==2)return delta(10);
        if(id==1)return delta(9);
        if(id==3)return delta(5);
        if(id==4){std::uint64_t n=0;for(std::size_t p=0;p<5;++p)n+=delta(p)>0;return n;}
        if(id==5)return delta(6)+delta(7)+delta(8);
        auto d=dayTotals();
        if(!summary() || schedule.elapsed<shiftLength || d[10]<3)return 0;
        if(id==6)return d[6]==0;
        if(id==7)return machineCondition.snapshot().cleanliness==1000;
        return dayProfit()>0;
    }
    std::uint64_t lifetimeProgress(std::size_t id) const {
        switch(id) {
            case 0:case 1:case 2:return journal.days;
            case 3:case 4:case 5:return journal.counts[10];
            case 6:return journal.counts[9];case 7:return journal.counts[0];case 8:return journal.counts[4];
            case 9:return std::popcount(unsigned(unlockedMask()&31));case 10:return journal.counts[5];
            case 11:return std::min<std::uint64_t>(5,journal.counts[6])+std::min<std::uint64_t>(5,journal.counts[7])+std::min<std::uint64_t>(5,journal.counts[8]);
            case 12:return journal.profitable;case 13:return journal.wasteFree;case 14:return crew.size();
            case 15:return (layout.find(20)||layout.find(21))+(layout.find(22)||layout.find(23));
            case 16:return tableCount();case 17:return int(fastMachine)+int(bool(extraStation))+int(bool(extraStorage));
        }
        return 0;
    }
    void journalNextDay() {
        journal.eligible=true;journal.baseline=journal.counts;
        journal.daily=0;journal.newAchievements=0;
    }
    void journalClose() {
        if(journal.settled==campaign.day)return;
        const auto d=dayTotals();
        if(journal.eligible && schedule.elapsed>=shiftLength && d[10]>0) {
            ++journal.days;if(dayProfit()>0)++journal.profitable;if(!d[6])++journal.wasteFree;
        }
        journal.daily=0;journal.newAchievements=0;
        if(journal.eligible) {
            const auto selection=dailySelection();
            for(std::size_t slot=0;slot<3;++slot)if(dailyProgress(selection[slot])>=dailyGoals[selection[slot]].target) {
                require(ledger->post("cafe:daily",ledger->sequence("cafe:daily")+1,dailyReward,runtime->time()));
                journal.daily|=std::uint64_t(1)<<slot;++journal.claims;
            }
        }
        // Even an early close may bank service/ownership achievements, but full
        // shift milestones and care goals require actual service time.
        for(std::size_t id=0;id<lifetimeGoals.size();++id) {
            auto bit=std::uint64_t(1)<<id;
            if(!(journal.achievements&bit) && lifetimeProgress(id)>=lifetimeGoals[id].target) {
                require(ledger->post("cafe:achievements",ledger->sequence("cafe:achievements")+1,achievementReward,runtime->time()));
                journal.achievements|=bit;journal.newAchievements|=bit;
            }
        }
        journal.settled=campaign.day;syncCash();
    }
    template<class Put> void saveJournal(Put put) const {
        put(journal.eligible);put(journal.days);put(journal.profitable);put(journal.wasteFree);put(journal.claims);
        put(journal.achievements);put(journal.newAchievements);put(journal.daily);put(journal.settled);
        for(auto n:journal.counts)put(n);for(auto n:journal.baseline)put(n);
    }
    template<class Get> bool loadJournal(Get get) {
        auto eligible=get();if(eligible>1)return false;journal.eligible=bool(eligible);
        journal.days=get();journal.profitable=get();journal.wasteFree=get();journal.claims=get();
        journal.achievements=get();journal.newAchievements=get();journal.daily=get();journal.settled=get();
        for(auto& n:journal.counts)n=get();for(auto& n:journal.baseline)n=get();
        if(journal.days>campaign.day || journal.profitable>journal.days || journal.wasteFree>journal.days || journal.claims>3*campaign.day ||
           journal.achievements>=(std::uint64_t(1)<<lifetimeGoals.size()) || (journal.newAchievements&journal.achievements)!=journal.newAchievements || journal.daily>7 ||
           journal.settled>campaign.day || (campaign.enabled && summary() && journal.settled!=campaign.day) ||
           (campaign.enabled && !summary() && journal.settled>=campaign.day) || (!summary() && (journal.daily || journal.newAchievements)) ||
           journal.claims<std::uint64_t(std::popcount(journal.daily)))return false;
        std::uint64_t products=0,regulars=0;
        for(std::size_t n=0;n<11;++n) {
            if(journal.counts[n]>deliveredReviews || journal.baseline[n]>journal.counts[n])return false;
            if(n<5)products+=journal.counts[n];if(n>=6 && n<=8){regulars+=journal.counts[n];if(journal.counts[n]>campaign.regulars[n-6].reviews)return false;}
        }
        // The five per-recipe counters cover the classic menu. Summer tickets
        // still count toward ticket/mixed/happy totals without borrowing those
        // slots (which also contain happiness and regular history).
        const auto deliveredItems=journal.counts[10]+journal.counts[9];
        if((summerCatalog?products>deliveredItems:products!=deliveredItems) || journal.counts[9]>journal.counts[10] || journal.counts[5]>journal.counts[10] || regulars>journal.counts[5])return false;
        if(!campaign.enabled && (journal.days || journal.claims || journal.achievements || journal.settled || products || journal.daily || journal.newAchievements))return false;
        if(debited("cafe:daily") || credited("cafe:daily")!=std::int64_t(journal.claims)*dailyReward || ledger->sequence("cafe:daily")!=journal.claims ||
           debited("cafe:achievements") || credited("cafe:achievements")!=std::popcount(journal.achievements)*achievementReward ||
           ledger->sequence("cafe:achievements")!=std::uint64_t(std::popcount(journal.achievements)))return false;
        if(summary() && journal.eligible) {
            const auto selection=dailySelection();
            for(std::size_t slot=0;slot<3;++slot)if(bool(journal.daily&(std::uint64_t(1)<<slot))!=(dailyProgress(selection[slot])>=dailyGoals[selection[slot]].target))return false;
        } else if(journal.daily)return false;
        for(std::size_t id=0;id<lifetimeGoals.size();++id)if((journal.newAchievements&(std::uint64_t(1)<<id)) && lifetimeProgress(id)<lifetimeGoals[id].target)return false;
        if(!campaign.checkpoint.empty()) {
            Simulation start;start.contentAccess=contentAccess;if(!start.load(campaign.checkpoint,true))return false;
            if((start.journal.achievements&journal.achievements)!=start.journal.achievements || start.journal.claims>journal.claims ||
               start.journal.baseline!=journal.baseline || start.journal.eligible!=journal.eligible)return false;
            for(std::size_t n=0;n<11;++n)if(start.journal.counts[n]>journal.counts[n])return false;
        }
        return true;
    }
    void migrateJournal() {
        if(ledger->sequence("cafe:daily") || ledger->sequence("cafe:achievements"))throw std::runtime_error("Unexpected legacy rewards");
        // No invented historical per-product/regular scores or retroactive daily
        // rewards. A migrated day begins participating at the next preparation.
        journal.eligible=campaign.phase==DayPhase::Preparation;
        journal.settled=campaign.enabled?campaign.day-(summary()?0:1):0;
        if(!campaign.checkpoint.empty()) {
            Simulation start;start.contentAccess=contentAccess;if(!start.load(campaign.checkpoint,true))throw std::runtime_error("Invalid journal checkpoint");
            start.journal.eligible=journal.eligible;campaign.checkpoint=start.save();
        }
    }
