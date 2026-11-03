#include "simulation.hpp"
#include "legacy_fixture.hpp"
#include "compatibility_cases.hpp"
#include "cafe_compatibility_cases.hpp"
#include "runtime_scale.hpp"
#include "diagnostics_cases.hpp"
#include "cafe_authoring_cases.hpp"
#include <limits>
#include <iostream>
#include <source_location>
#include "travel_cases.hpp"
#include "occupancy_cases.hpp"
#include "workflow_cases.hpp"
#include "supply_cases.hpp"
#include "economy_cases.hpp"
#include "cafe_economy_cases.hpp"
#include "quality_cases.hpp"
#include "layout_cases.hpp"
#include "cafe_layout_cases.hpp"
#include "cafe_quality_cases.hpp"
#include "demand_cases.hpp"
#include "cafe_demand_cases.hpp"
#include "cafe_menu_cases.hpp"
#include "cafe_staff_cases.hpp"
#include "cafe_campaign_cases.hpp"
#include "cafe_journal_cases.hpp"
#include "cafe_table_journal_cases.hpp"
#include "cafe_equipment_cases.hpp"
#include "cafe_schedule_cases.hpp"
int main() {
  try {
    int failures=0;
    auto suite=[&](const char* name,auto run){try{run();}catch(const std::exception& e){++failures;std::cerr<<name<<": "<<e.what()<<"\n";}};
    suite("cafeJournalChecks",[]{cafeJournalChecks();});
    suite("cafeTableJournalChecks",[]{cafeTableJournalChecks();});
    suite("cafeScheduleChecks",[]{cafeScheduleChecks();});
    suite("cafeEquipmentChecks",[]{cafeEquipmentChecks();});
    suite("cafeCampaignChecks",[]{cafeCampaignChecks();});
    suite("cafeStaffChecks",[]{cafeStaffChecks();});
    suite("cafeMenuChecks",[]{cafeMenuChecks();});
    suite("compatibilityChecks",[]{compatibilityChecks();});
    suite("cafeCompatibilityChecks",[]{cafeCompatibilityChecks();});
    suite("scaleChecks",[]{scaleChecks();});
    suite("diagnosticsChecks",[]{diagnosticsChecks();});
    suite("cafeAuthoringChecks",[]{cafeAuthoringChecks();});
    suite("demandChecks",[]{demandChecks();});
    suite("cafeDemandChecks",[]{cafeDemandChecks();});
    suite("layoutChecks",[]{layoutChecks();});
    suite("cafeLayoutChecks",[]{cafeLayoutChecks();});
    suite("qualityChecks",[]{qualityChecks();});
    suite("cafeQualityChecks",[]{cafeQualityChecks();});
    suite("economyChecks",[]{economyChecks();});
    suite("cafeEconomyChecks",[]{cafeEconomyChecks();});
    suite("supplyChecks",[]{supplyChecks();});
    suite("cafeSupplyChecks",[]{cafeSupplyChecks();});
    suite("workflowChecks",[]{workflowChecks();});
    suite("cafeWorkflowChecks",[]{cafeWorkflowChecks();});
    suite("travelChecks",[]{travelChecks();});
    suite("occupancyChecks",[]{occupancyChecks();});
    if(failures)throw std::runtime_error(std::to_string(failures)+" regression suites failed");
    cafe::Simulation game;
    auto check = [](bool ok,std::source_location at=std::source_location::current()) { if (!ok) throw std::runtime_error("Simulation line "+std::to_string(at.line())); };
    check(!game.serve());
    check(game.brew());
    check(!game.brew());
    game.advance(2);
    check(!game.ready && !game.serve());
    game.advance(1);
    check(game.ready && !game.brew());
    check(game.serve() && game.served == 1 && game.coins == 5);
    check(!game.serve());
    check(game.brew());
    game.advance(1);
    auto during=game.save();
    cafe::Simulation restored;
    check(restored.load(during));
    check(restored.brewing==2 && restored.stock==98 && restored.outputHeld==1);
    auto before=restored.save();auto invalid=before;invalid.pop_back();
    check(!restored.load(invalid) && restored.save()==before);
    check(restored.cancel() && restored.stock==98 && restored.outputHeld==0);
    check(restored.load(during));restored.advance(2);
    check(restored.ready && restored.serve() && restored.coins==10);
    auto paid=restored.save();check(restored.load(paid));
    restored.advance(1);check(restored.coins==10 && restored.served==2 && !restored.serve());
    check(restored.load(paid) && restored.coins==10);
    invalid=paid;invalid[8]=99;check(!restored.load(invalid) && restored.coins==10);
    // Wallet/receipt sequence is validated together with the core snapshot.
    invalid=paid;invalid[16]=3;check(!restored.load(invalid));
    game.advance(10);
    check(game.ready);
    bool rejected = false;
    try { game.advance(std::numeric_limits<double>::quiet_NaN()); } catch (const std::invalid_argument&) { rejected = true; }
    check(rejected);
    std::cout << "Simulation checks passed\n";
  } catch(const std::exception& e) {std::cerr << e.what() << '\n';return 1;}
}
