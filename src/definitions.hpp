#pragma once
#include "engine/simulator/diagnostics.hpp"
#include "engine/simulator/demand.hpp"
#include <array>

namespace cafe::definitions {
inline constexpr std::size_t baseResources=11,baseProcesses=8,baseMenu=5,baseIngredients=5;
// Game-owned authoring surface. IDs are persistent content keys; edit rules here
// and rebuild all hosts. Initial conditions are separate from running state.
// Keep the original keys stable. Intermediate shots are not saleable espresso.
inline const std::array resources{
    engine::simulator::ResourceId{"cafe:beans"},engine::simulator::ResourceId{"cafe:espresso"},
    engine::simulator::ResourceId{"cafe:water"},engine::simulator::ResourceId{"cafe:milk"},
    engine::simulator::ResourceId{"cafe:tea-leaves"},engine::simulator::ResourceId{"cafe:pastry-stock"},
    engine::simulator::ResourceId{"cafe:americano"},engine::simulator::ResourceId{"cafe:latte"},
    engine::simulator::ResourceId{"cafe:tea"},engine::simulator::ResourceId{"cafe:croissant"},
    engine::simulator::ResourceId{"cafe:shot"},
    engine::simulator::ResourceId{"garden:ice"},engine::simulator::ResourceId{"garden:lemon-base"},engine::simulator::ResourceId{"garden:cake-stock"},
    engine::simulator::ResourceId{"garden:iced-coffee"},engine::simulator::ResourceId{"garden:lemonade"},engine::simulator::ResourceId{"garden:berry-cake"}};
inline const std::array processes{
    engine::simulator::Process{{"cafe:espresso"},{{resources[0],1}},{{resources[1],1}},3000,"cafe:brew"},
    engine::simulator::Process{{"cafe:americano"},{{resources[10],1},{resources[2],1}},{{resources[6],1}},1000,"cafe:water"},
    engine::simulator::Process{{"cafe:latte"},{{resources[10],1},{resources[3],1}},{{resources[7],1}},2000,"cafe:steam"},
    engine::simulator::Process{{"cafe:tea"},{{resources[2],1},{resources[4],1}},{{resources[8],1}},2500,"cafe:water"},
    engine::simulator::Process{{"cafe:croissant"},{{resources[5],1}},{{resources[9],1}},500,"cafe:plate"},
    engine::simulator::Process{{"cafe:shot"},{{resources[0],1}},{{resources[10],1}},3000,"cafe:brew"},
    engine::simulator::Process{{"cafe:espresso-fast"},{{resources[0],1}},{{resources[1],1}},1800,"cafe:brew"},
    engine::simulator::Process{{"cafe:shot-fast"},{{resources[0],1}},{{resources[10],1}},1800,"cafe:brew"},
    engine::simulator::Process{{"garden:iced-coffee"},{{resources[10],1},{resources[11],1},{resources[2],1}},{{resources[14],1}},1500,"garden:cold"},
    engine::simulator::Process{{"garden:lemonade"},{{resources[2],1},{resources[11],1},{resources[12],1}},{{resources[15],1}},1200,"garden:cold"},
    engine::simulator::Process{{"garden:berry-cake"},{{resources[13],1}},{{resources[16],1}},500,"cafe:plate"}};
struct Product {const char* name;int resource;std::int64_t price,lifetime;bool shot;};
inline constexpr std::array<Product,8> menu{{
    {"Espresso",1,500,45000,false},{"Americano",6,600,45000,true},
    {"Latte",7,700,45000,true},{"Tea",8,400,60000,false},
    {"Croissant",9,350,120000,false},{"Iced coffee",14,750,60000,true},
    {"Lemonade",15,650,90000,false},{"Berry cake",16,550,120000,false}}};
struct Ingredient {const char* name;int resource;std::int64_t price;};
inline constexpr std::array<Ingredient,8> ingredients{{
    {"Beans",0,100},{"Water",2,25},{"Milk",3,100},{"Tea leaves",4,50},{"Pastry stock",5,150},
    {"Ice",11,50},{"Lemon base",12,100},{"Cake stock",13,200}}};
struct GuestProfile {const char* name;engine::simulator::Milliseconds patience;engine::simulator::SatisfactionWeights weights;bool takeaway;};
inline constexpr std::array<GuestProfile,3> profiles{{
    {"House regular",120000,{30,40,20,10},false},
    {"Commuter",90000,{55,25,10,10},true},
    {"Espresso enthusiast",150000,{10,65,15,10},false}}};
}
