    enum class PeriodStage {Service,Finishing,Intermission};
    struct Schedule {
        std::uint64_t day=1;
        std::int64_t elapsed=0;
        int period=0;
        PeriodStage stage=PeriodStage::Service;
    } schedule;
    static constexpr std::size_t scheduleSaveBytes=32;
    static constexpr std::array<std::int64_t,3> periodEnds{240000,360000,600000};
    static constexpr std::array<const char*,3> periodNames{"Morning","Lunch","Afternoon"};
    bool intermission() const {return schedule.stage==PeriodStage::Intermission;}
    bool clockRunning() const {return schedule.stage==PeriodStage::Service && !closed && (!campaign.enabled || campaign.phase==DayPhase::Open);}
    int clockMinutes() const {return 480+int(schedule.elapsed/1000);}
    void scheduleTick() {
        if(clockRunning() && schedule.elapsed>=periodEnds[std::size_t(schedule.period)]) {
            schedule.elapsed=periodEnds[std::size_t(schedule.period)];
            schedule.stage=PeriodStage::Finishing;closed=true;
            if(campaign.enabled && schedule.period==2)closeDay();
        }
        // Clear existing visits before opening the purchase/build break. Runtime
        // time may still advance for deliveries and restocking during the break;
        // business time and wages remain stopped until an explicit continuation.
        if(schedule.stage==PeriodStage::Finishing && (!campaign.enabled || campaign.phase==DayPhase::Open || summary()) &&
            guests.empty() && !active() && tasks->tasks().empty() && !incomingSupply()) {
            schedule.stage=PeriodStage::Intermission;
        }
    }
    bool canContinuePeriod() const {return intermission() && guests.empty() && !active() && tasks->tasks().empty() && !incomingSupply() && !summary() && (!campaign.enabled || campaign.phase==DayPhase::Open) && !(schedule.period==2 && (campaign.enabled || schedule.day>=1000000));}
    bool nextPeriod() {
        if(!canContinuePeriod())return false;
        if(schedule.period==2) {
            if(campaign.enabled || schedule.day>=1000000)return false;
            ++schedule.day;schedule.elapsed=0;schedule.period=0;
        }else ++schedule.period;
        schedule.stage=PeriodStage::Service;closed=false;pending=0;fraction=0;return true;
    }
    void migrateSchedule() {
        schedule={};
        if(!campaign.enabled)return;
        schedule.day=campaign.day;
        if(campaign.phase==DayPhase::Preparation)return;
        schedule.elapsed=std::clamp<std::int64_t>(runtime->time()-campaign.openedAt,0,shiftLength);
        schedule.period=schedule.elapsed<periodEnds[0]?0:schedule.elapsed<periodEnds[1]?1:2;
        schedule.stage=summary()?PeriodStage::Intermission:campaign.phase==DayPhase::Closing?PeriodStage::Finishing:PeriodStage::Service;
    }
    bool validSchedule() const {
        if(!schedule.day || schedule.day>1000000 || schedule.elapsed<0 || schedule.elapsed>shiftLength || schedule.period<0 || schedule.period>2)return false;
        const auto begin=schedule.period?periodEnds[std::size_t(schedule.period-1)]:0,end=periodEnds[std::size_t(schedule.period)];
        if(schedule.elapsed<begin || schedule.elapsed>end)return false;
        if(schedule.stage==PeriodStage::Service && schedule.elapsed==end)return false;
        if(schedule.stage!=PeriodStage::Service && !closed)return false;
        if(intermission() && (!guests.empty() || active()))return false;
        if(campaign.enabled) {
            if(schedule.day!=campaign.day)return false;
            if(campaign.phase==DayPhase::Preparation && (schedule.elapsed || schedule.period || schedule.stage!=PeriodStage::Service))return false;
            if(summary() && !intermission())return false;
            if(campaign.phase==DayPhase::Closing && schedule.stage!=PeriodStage::Finishing)return false;
            if(campaign.phase!=DayPhase::Preparation && schedule.elapsed>runtime->time()-campaign.openedAt)return false;
        }
        if((!campaign.enabled || campaign.phase==DayPhase::Open) && schedule.stage!=PeriodStage::Service && schedule.elapsed!=end)return false;
        return true;
    }
    template<class Put> void saveSchedule(Put put) const {put(schedule.day);put(schedule.elapsed);put(schedule.period);put(std::uint64_t(schedule.stage));}
    template<class Get> bool loadSchedule(Get get) {
        auto day=get(),elapsed=get(),period=get(),stage=get();
        if(!day || day>1000000 || elapsed>shiftLength || period>2 || stage>2)return false;
        schedule={day,std::int64_t(elapsed),int(period),PeriodStage(stage)};return true;
    }
