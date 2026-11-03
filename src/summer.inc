    bool summerCatalog=false;
    sim::StationId coldStation{};
    std::size_t ingredientCount() const {return summerCatalog?8:5;}
    std::size_t resourceCount() const {return summerCatalog?17:11;}
    bool summerProgress() const {return summerCatalog && courtyardOpen() && (!campaign.enabled || (campaign.goals&3)==3) && (!gardenStory.started || gardenStory.summerLegacy || (gardenStory.chapters&2));}
    bool ingredientDemand(std::size_t n) const {return n<5 || (summerProgress() && (n==7 || bool(coldStation)));}
    std::string recipeReason(int product) const {
        if(product<0 || product>=8)return "Choose a menu item.";
        if(product<5)return (unlockedMask()&(1<<product))?"":"Complete campaign objectives to unlock this recipe.";
        if(!summerCatalog || !gardenState.selected)return "Select owned Garden Cafe content to use summer recipes.";
        if(!courtyardOpen())return "Open the courtyard before adding summer recipes.";
        if(campaign.enabled && (campaign.goals&3)!=3)return "Serve the first paid ticket and a mixed order to unlock summer recipes.";
        if(gardenStory.started && !gardenStory.summerLegacy && !(gardenStory.chapters&2))return "Serve an outdoor ticket in the restoration campaign to unlock summer recipes.";
        if((product==5 || product==6) && !coldStation)return "Install a cold-preparation station for this recipe.";
        return {};
    }
    // Called only on a detached candidate or while authoring a fresh session.
    // The public simulator additions preserve existing jobs/holds and identities.
    void enableSummerCatalog() {
        if(summerCatalog)return;
        require(runtime->extendResources(std::span(definitions::resources).subspan(11)));
        std::vector<sim::Amount> work,store;
        for(std::size_t n=11;n<definitions::resources.size();++n)work.push_back({definitions::resources[n],24});
        for(std::size_t n=5;n<8;++n)store.push_back({ingredient(n),24});
        require(runtime->extendInventory(inventory,work));require(runtime->extendInventory(storage,store));require(runtime->extendInventory(annex,store));
        for(std::size_t n=8;n<definitions::processes.size();++n)require(runtime->defineProcess(definitions::processes[n]));
        for(const auto& w:crew)require(runtime->extendWorker(w.id,std::array{std::string{"garden:cold"}}));
        summerCatalog=true;
    }
