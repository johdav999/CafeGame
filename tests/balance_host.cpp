#include "balance.hpp"
#include <charconv>
#include <iostream>

int main(int argc,char** argv) {
    try {
        if(auto issues=cafe::validateContent();!issues.empty()) {
            for(const auto& issue:issues)std::cerr<<issue<<'\n';return 1;
        }
        if(argc==2 && std::string_view(argv[1])=="--validate") {std::cout<<cafe::authoredContent()<<'\n';return 0;}
        if(argc!=4)throw std::invalid_argument("Usage: cafe_balance SCENARIO SEED SECONDS, or --validate");
        const cafe::Scenario* selected=nullptr;
        for(const auto& s:cafe::scenarios)if(s.key==argv[1])selected=&s;
        if(!selected)throw std::invalid_argument("Unknown scenario");
        auto parse=[](std::string_view text) {std::uint32_t value=0;auto result=std::from_chars(text.data(),text.data()+text.size(),value);if(result.ec!=std::errc{} || result.ptr!=text.data()+text.size() || !value)throw std::invalid_argument("Expected positive uint32");return value;};
        auto seed=parse(argv[2]),seconds=parse(argv[3]);if(seconds>3600)throw std::invalid_argument("Duration exceeds one hour");
        std::cout<<cafe::runBalance(*selected,seed,int(seconds))<<'\n';
    } catch(const std::exception& e) {std::cerr<<e.what()<<'\n';return 1;}
}
