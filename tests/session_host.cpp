#include "diagnostics.hpp"
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>

// Minimal native (including Windows) host: explicit steps make scenarios repeatable.
int main() {
    cafe::Simulation game{4,5000};
    std::cout << "Commands: brew, step (1 second), serve, cancel, order, restock, supplies-cancel, auto, break, clean-machine, repair, cancel-care, traffic, guest PROFILE, hire, dismiss ID, staff-break ID, priority ID ROLE VALUE, close, layout ACTION ID X Z ROTATION (grid cells), scenario KEY, inspect, report, validate, save, load, quit\n";
    for (std::string command; std::cin >> command && command != "quit";) {
        try {
            if(command=="inspect")std::cout<<cafe::inspectShift(game)<<'\n';
            else if(command=="campaign")game.startCampaign();
            else if(command=="open-day")game.openDay();
            else if(command=="close-day")game.closeDay();
            else if(command=="next-day")game.nextDay();
            else if(command=="restart-day")game.restartDay();
            else if(command=="report")std::cout<<cafe::shiftReport(game)<<'\n';
            else if(command=="validate") {for(const auto& issue:cafe::validateContent())std::cout<<issue<<'\n';std::cout<<cafe::authoredContent()<<'\n';}
            else if(command=="scenario") {std::string key;std::cin>>key;bool started=false;for(const auto& s:cafe::scenarios)if(s.key==key)started=cafe::startScenario(game,s);if(!started)throw std::runtime_error("Invalid scenario");}
            else if (command == "brew") game.brew();
            else if (command == "step") game.advance(1);
            else if (command == "serve") game.serve();
            else if (command == "cancel") game.cancel();
            else if (command == "order") game.orderBeans();
            else if (command == "restock") game.restock();
            else if (command == "supplies-cancel") game.cancelSupply();
            else if (command == "auto") game.automaticSupply=!game.automaticSupply;
            else if (command == "break") game.takeBreak();
            else if (command == "hire") game.hire();
            else if (command == "dismiss" || command == "staff-break") {std::uint64_t id;if(!(std::cin>>id))throw std::runtime_error("Invalid staff id");auto worker=cafe::sim::WorkerId{id,game.runtime->epoch()};if(command=="dismiss")game.dismiss(worker);else game.staffBreak(worker);}
            else if (command == "priority") {std::uint64_t id;int role,value;if(!(std::cin>>id>>role>>value))throw std::runtime_error("Invalid priority arguments");game.setPriority({id,game.runtime->epoch()},role,value);}
            else if (command == "clean-machine") game.requestMaintenance(cafe::Simulation::Maintenance::Clean);
            else if (command == "repair") game.requestMaintenance(cafe::Simulation::Maintenance::Repair);
            else if (command == "cancel-care") game.cancelMaintenance();
            else if (command == "traffic") game.automaticGuests=!game.automaticGuests;
            else if (command == "guest") {int profile;if(!(std::cin>>profile))throw std::runtime_error("Invalid profile");game.welcome(profile);}
            else if (command == "close") game.toggleClosed();
            else if (command == "layout") {int action,id,x,z,rotation;if(!(std::cin>>action>>id>>x>>z>>rotation))throw std::runtime_error("Invalid layout arguments");game.editLayout(action,id,x,z,rotation);}
            else if (command == "save") {
                auto bytes = game.save();
                std::ofstream file("cafe-shift.save", std::ios::binary);
                file.write(reinterpret_cast<const char*>(bytes.data()), bytes.size());
                if (!file) throw std::runtime_error("Save failed");
            } else if (command == "load") {
                std::ifstream file("cafe-shift.save", std::ios::binary | std::ios::ate);
                auto size = file.tellg();
                if (!file || size < 0 || size > cafe::Simulation::maxSaveBytes)
                    throw std::runtime_error("Invalid save size");
                std::vector<std::uint8_t> bytes(static_cast<std::size_t>(size));
                file.seekg(0); file.read(reinterpret_cast<char*>(bytes.data()), size);
                if(!file)throw std::runtime_error("Save read failed");
                auto result=game.restore(bytes);if(!result)throw std::runtime_error(cafe::describeLoad(result.error));
                if(result.migrated)std::cout<<"Save upgraded in memory; use save to keep the new format.\n";
            }
            std::vector<cafe::sim::CustomerId> departing;
            for(const auto& g:game.guests)if(g.phase==cafe::Simulation::GuestPhase::Leaving)departing.push_back(g.id);
            for(auto id:departing)game.departed(id);
            std::cout << "Closed " << game.closed << " tables " << game.layout.placements().size() << " " << game.layoutMessage << "\nOrder " << game.orderState << " job " << game.jobState
                      << " beans " << game.stock << " brewing " << game.brewing
                      << " ready " << game.ready << " cash_minor " << game.wallet
                      << " reputation " << game.reputation() << " reviews " << game.reviewCount() << " visits_in_ms " << game.arrivals.remaining << " profit_minor " << game.profit() << " wages_due_minor " << game.wagesDue() << '\n';
        } catch (const std::exception& error) { std::cerr << error.what() << '\n'; }
    }
}
