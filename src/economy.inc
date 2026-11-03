    std::unique_ptr<sim::Ledger> ledger;
    std::int64_t staffedMs=0,pendingSupplyCost=0;
    std::uint64_t legacyServed=0;
    std::string economyMessage;
    sim::Quantity credited(const char* key) const {auto* s=ledger->stream(key);return s?s->credits:0;}
    sim::Quantity debited(const char* key) const {auto* s=ledger->stream(key);return s?s->debits:0;}
    sim::Quantity wagesDue() const {return expectedWages()-debited("cafe:wages");}
    sim::Quantity availableCash() const {return std::max<sim::Quantity>(0,ledger->balance()-wagesDue());}
    sim::Quantity profit() const {return ledger->credits()-ledger->debits();}
    void syncCash() {wallet=ledger->balance();coins=int(wallet/100);}
    void settleWages() {
        auto amount=std::min(wagesDue(),(ledger->balance()/100)*100);
        if(amount){auto paid=ledger->post("cafe:wages",ledger->sequence("cafe:wages")+1,-amount,runtime->time());if(!paid)economyMessage=std::string(sim::describe(paid.error));else for(auto& w:crew){auto due=(w.worked/60000)*100-w.paid;auto share=std::min(amount,due);w.paid+=share;amount-=share;}}
        syncCash();
    }
    template<class Put> void saveEconomy(Put put) const {
        auto text=[&](const std::string& s){put(s.size());for(unsigned char c:s)put(c);};
        put(legacyServed);put(staffedMs);put(pendingSupplyCost);
        auto s=ledger->snapshot();put(s.opening);put(s.balance);put(s.nextEntry);put(s.archived.size());
        for(const auto& stream:s.archived){text(stream.key);put(stream.sequence);put(stream.credits);put(stream.debits);}
        put(s.entries.size());
        for(const auto& e:s.entries){put(e.id);text(e.stream);put(e.sequence);put(std::bit_cast<std::uint64_t>(e.amount));put(e.time);}
    }
    template<class Get> bool loadEconomy(Get get,bool hasRoster=true) {
        auto number=[&](){auto n=get();if(n>1000000000)throw std::runtime_error("Economy number limit");return std::int64_t(n);};
        auto text=[&](){auto n=get();if(n>24)throw std::runtime_error("Economy key limit");std::string s;while(n--){auto c=get();if(c>127)throw std::runtime_error("Invalid economy key");s+=char(c);}return s;};
        auto valid=[](const std::string& key){return key=="garden:chapters" || key=="garden:table-buys" || key=="garden:table-sales" || key=="cafe:sales" || key=="cafe:purchases" || key=="cafe:refunds" || key=="cafe:wages" || key=="cafe:maintenance" || key=="cafe:repair-refunds" || key=="cafe:furniture-buys" || key=="cafe:furniture-sales" || key=="cafe:hires" || key=="cafe:overhead" || key=="cafe:goals" || key=="cafe:upgrades" || key=="cafe:resale" || key=="cafe:daily" || key=="cafe:achievements";};
        legacyServed=get();auto staffed=get();pendingSupplyCost=number();
        if(legacyServed>std::uint64_t(served) || staffed>1800000000000ULL || staffed>std::uint64_t(runtime->time())*3)return false;
        staffedMs=std::int64_t(staffed);
        sim::LedgerSnapshot s;s.opening=number();s.balance=number();s.nextEntry=get();
        auto count=get();if(count>18)return false; // base, garden tables and chapter rewards
        while(count--){sim::LedgerStream stream;stream.key=text();if(!valid(stream.key))return false;stream.sequence=get();stream.credits=number();stream.debits=number();s.archived.push_back(stream);}
        count=get();if(count>128)return false;
        while(count--){sim::LedgerEntry e;e.id=get();e.stream=text();if(!valid(e.stream))return false;e.sequence=get();e.amount=std::bit_cast<std::int64_t>(get());auto time=get();if(time>std::uint64_t(runtime->time()))return false;e.time=std::int64_t(time);s.entries.push_back(e);}
        ledger=std::make_unique<sim::Ledger>(0,128,18);if(!ledger->restore(s) || ledger->balance()!=wallet)return false;
        if(!hasRoster){crew[0].worked=staffedMs;crew[0].paid=debited("cafe:wages");}
        auto worked=retiredWorked,paidWages=retiredWages;
        for(const auto& w:crew){worked+=w.worked;paidWages+=w.paid;}
        if(worked!=staffedMs || paidWages!=debited("cafe:wages") || credited("cafe:hires") || debited("cafe:hires")!=std::int64_t(ledger->sequence("cafe:hires"))*hireCost || ledger->sequence("cafe:hires")>10000 || crew.size()>1+ledger->sequence("cafe:hires"))return false;
        if(legacyServed && s.opening!=std::int64_t(legacyServed)*500)return false;
        auto sales=std::uint64_t(served)-legacyServed;
        if(ledger->sequence("cafe:sales")!=sales || credited("cafe:sales")<std::int64_t(sales)*350 || credited("cafe:sales")>std::int64_t(sales)*1450 || credited("cafe:sales")%50 || debited("cafe:sales") ||
           credited("cafe:purchases") || debited("cafe:refunds") || credited("cafe:wages") ||
           credited("cafe:refunds")>debited("cafe:purchases") || ledger->sequence("cafe:refunds")>ledger->sequence("cafe:purchases") ||
           debited("cafe:wages")%100 || wagesDue()<0 || credited("cafe:maintenance") || debited("cafe:repair-refunds") ||
           credited("cafe:repair-refunds")>debited("cafe:maintenance") || ledger->sequence("cafe:repair-refunds")>ledger->sequence("cafe:maintenance"))return false;
        if(credited("cafe:furniture-buys") || debited("cafe:furniture-sales") ||
           ledger->sequence("cafe:furniture-buys")>1000000 || ledger->sequence("cafe:furniture-sales")>1000002 ||
           debited("cafe:furniture-buys")!=std::int64_t(ledger->sequence("cafe:furniture-buys"))*600 ||
           credited("cafe:furniture-sales")!=std::int64_t(ledger->sequence("cafe:furniture-sales"))*300)return false;
        for(const auto& e:ledger->entries()) {
            if((e.stream=="cafe:sales" && (e.amount<350 || e.amount>1450 || e.amount%50)) ||
               (e.stream=="cafe:purchases" && (e.amount>=0 || e.amount%25 || e.amount < -2400)) ||
               (e.stream=="cafe:refunds" && (e.amount<=0 || e.amount%25 || e.amount>2400)) ||
               (e.stream=="cafe:wages" && (e.amount>=0 || e.amount%100)) ||
               (e.stream=="cafe:maintenance" && e.amount!=-500 && e.amount!=-750) || (e.stream=="cafe:repair-refunds" && e.amount!=500 && e.amount!=750) ||
               (e.stream=="cafe:upgrades" && std::none_of(buildItems.begin(),buildItems.end(),[&](const auto& item){return e.amount==-item.price;})) ||
               (e.stream=="cafe:resale" && std::none_of(buildItems.begin(),buildItems.end(),[&](const auto& item){return e.amount==item.refund;})) ||
               (e.stream=="cafe:hires" && e.amount!=-hireCost) ||
               (e.stream=="cafe:overhead" && (e.amount>=0 || e.amount < -500)) || (e.stream=="cafe:goals" && e.amount!=500) ||
               (e.stream=="cafe:daily" && e.amount!=200) || (e.stream=="cafe:achievements" && e.amount!=500) || (e.stream=="garden:chapters" && e.amount!=gardenChapterReward) ||
               (e.stream=="garden:table-buys" && e.amount!=-600) || (e.stream=="garden:table-sales" && e.amount!=300) || (e.stream=="cafe:furniture-buys" && e.amount!=-600) || (e.stream=="cafe:furniture-sales" && e.amount!=300))return false;
        }
        auto* incoming=incomingSupply();
        sim::Quantity unitPrice=0;if(incoming)for(std::size_t n=0;n<ingredientCount();++n)if(incoming->amounts[0].resource==ingredient(n))unitPrice=definitions::ingredients[n].price;
        if((bool(pendingSupplyCost)!=bool(incoming)) || (pendingSupplyCost && (!incoming || pendingSupplyCost!=incoming->amounts[0].quantity*unitPrice ||
           debited("cafe:purchases")-credited("cafe:refunds")<pendingSupplyCost)))return false;
        return true;
    }
