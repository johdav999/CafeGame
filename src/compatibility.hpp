#pragma once
#include "definitions.hpp"
#include "garden.hpp"
#include "engine/simulator/compatibility.hpp"

namespace cafe {
inline constexpr std::uint64_t saveSchema=24;
inline constexpr std::size_t compatibilitySaveBytes=16;
// Bump for intentional rule changes in simulation.hpp / the policy .inc files.
// Catalog/profile values are hashed automatically; presets and labels do not run
// existing shifts. Unknown content never gets an implicit migration.
inline constexpr std::uint32_t contentVersion=21;
inline constexpr std::uint64_t ruleRevision=21;
inline engine::simulator::ContentStamp contentForRules(std::uint32_t version,std::uint64_t revision) {
    engine::simulator::ContentHash hash;hash.text("cafegame:content-v1");hash.word(revision);
    const auto resources=version<=19?11u:17u,processes=version<=19?8u:11u,menu=version<=19?5u:8u;
    hash.word(resources);for(std::size_t n=0;n<resources;++n)hash.text(definitions::resources[n].value);
    hash.word(processes);
    for(std::size_t n=0;n<processes;++n) {
        const auto& p=definitions::processes[n];
        hash.text(p.id.value);hash.word(p.inputs.size());for(const auto& a:p.inputs){hash.text(a.resource.value);hash.word(std::uint64_t(a.quantity));}
        hash.word(p.outputs.size());for(const auto& a:p.outputs){hash.text(a.resource.value);hash.word(std::uint64_t(a.quantity));}
        hash.word(std::uint64_t(p.duration));hash.text(p.capability);
    }
    hash.word(definitions::profiles.size());
    for(const auto& p:definitions::profiles) {
        hash.word(std::uint64_t(p.patience));hash.word(p.weights.wait);hash.word(p.weights.product);hash.word(p.weights.cleanliness);hash.word(p.weights.preference);hash.word(p.takeaway);
    }
    for(std::size_t n=0;n<menu;++n){const auto& p=definitions::menu[n];hash.word(p.resource);hash.word(p.price);hash.word(p.lifetime);hash.word(p.shot);}
    for(std::size_t n=0;n<menu;++n){const auto& i=definitions::ingredients[n];hash.word(i.resource);hash.word(i.price);}
    return {version,hash.value()};
}
inline engine::simulator::ContentStamp currentContent() {return contentForRules(contentVersion,ruleRevision);
}
// Frozen identity of the shipped schema 1..8 default rules/catalog. Never update
// this alongside new content: an old save must not silently acquire new rules.
inline constexpr engine::simulator::ContentStamp legacyContent{1,0xeb26419b68bf8c13ULL};
inline constexpr engine::simulator::ContentStamp menuContent{2,4750974716593505561ULL};
inline constexpr engine::simulator::ContentStamp staffContent{3,10200609897987242588ULL};
inline constexpr engine::simulator::ContentStamp campaignContent{4,14060639509978425351ULL};
inline constexpr engine::simulator::ContentStamp equipmentContent{5,0xb6b6c01543e2d72cULL};
enum class LoadError {None,Malformed,UnsupportedSchema,ContentVersion,ContentMismatch,ExpansionUnavailable,ExpansionContent};
struct LoadResult {
    LoadError error=LoadError::None;
    std::uint64_t sourceSchema=0;
    bool migrated=false;
    explicit operator bool() const {return error==LoadError::None;}
};
inline const char* describeLoad(LoadError error) {
    switch(error) {
        case LoadError::None:return "Saved shift restored.";
        case LoadError::Malformed:return "Save is damaged or inconsistent. Your current shift is unchanged.";
        case LoadError::UnsupportedSchema:return "Save uses an unsupported format. Your current shift is unchanged.";
        case LoadError::ContentVersion:return "Save needs a different content version. Your current shift is unchanged.";
        case LoadError::ContentMismatch:return "Save belongs to different game rules or definitions. Your current shift is unchanged.";
        case LoadError::ExpansionUnavailable:return "This save requires installed and owned Garden Café content. Your current café and device save are unchanged. Start a separate base café or restore access before loading.";
        case LoadError::ExpansionContent:return "This save requires unsupported expansion content. Your current café and device save are unchanged.";
    }
    return "Save rejected. Your current shift is unchanged.";
}
inline LoadResult inspectSave(std::span<const std::uint8_t> bytes,engine::simulator::ContentStamp expected=currentContent(),garden::Access access={}) {
    if(bytes.size()<88 || bytes.size()>8*1024*1024+65536)return {LoadError::Malformed};
    auto word=[&](std::size_t offset){std::uint64_t value=0;for(int i=0;i<8;++i)value|=std::uint64_t(bytes[offset+i])<<(8*i);return value;};
    if(word(0)!=0x43414645)return {LoadError::Malformed};
    auto version=word(8);
    if(version<1 || version>saveSchema)return {LoadError::UnsupportedSchema,version};
    if(version>=20) {
        const auto gardenBytes=version==20?garden::foundationSaveBytes:garden::saveBytes;
        if(bytes.size()<88+compatibilitySaveBytes+gardenBytes)return {LoadError::Malformed,version};
        auto offset=bytes.size()-compatibilitySaveBytes-gardenBytes;
        auto required=word(offset),packVersion=word(offset+8),hash=word(offset+16),phase=word(offset+24);
        if(required & ~garden::requiredBit)return {LoadError::ExpansionContent,version};
        if(phase>std::uint64_t(version==20?garden::Restoration::Locked:garden::Restoration::CourtyardOpen) || (!required && phase))return {LoadError::Malformed,version};
        if(!required && (packVersion || hash))return {LoadError::Malformed,version};
        if(required) {
            const auto wantedVersion=version==20?1:version==21?2:version==22?3:version==23?4:garden::contentVersion;
            if(packVersion!=wantedVersion || hash!=garden::fingerprint(wantedVersion))return {LoadError::ExpansionContent,version};
            if(!access.available())return {LoadError::ExpansionUnavailable,version};
        }
    }
    engine::simulator::ContentStamp stamp=legacyContent;
    if(version>=9) {
        if(bytes.size()<88+compatibilitySaveBytes || word(bytes.size()-16)>UINT32_MAX)return {LoadError::Malformed,version};
        stamp={std::uint32_t(word(bytes.size()-16)),word(bytes.size()-8)};
    }
    auto checked=engine::simulator::checkContent(stamp,expected);
    if(version==23 && stamp==contentForRules(20,20) && expected==currentContent())return {LoadError::None,version,true};
    if(version==22 && stamp==contentForRules(19,19) && expected==currentContent())return {LoadError::None,version,true};
    if(version==21 && stamp==contentForRules(18,18) && expected==currentContent())return {LoadError::None,version,true};
    if(version==20 && stamp==contentForRules(17,17) && expected==currentContent())return {LoadError::None,version,true};
    if(version==19 && stamp==contentForRules(16,16) && expected==currentContent())return {LoadError::None,version,true};
    // Four-table arrangement adds an atomic layout action; existing furniture,
    // deadlines, balances and opening checkpoints are preserved.
    if(version==19 && stamp==contentForRules(15,15) && expected==currentContent())return {LoadError::None,version,true};
    // Existing guests keep their original deadlines; new visits use separate
    // table/service timers. Layout, rewards and checkpoints retain their data.
    if(version==19 && stamp==contentForRules(14,14) && expected==currentContent())return {LoadError::None,version,true};
    // Appeal-scaled foot traffic preserves the already scheduled arrival and
    // all existing visitors. Only newly scheduled intervals use the new rule.
    if(version==19 && stamp==contentForRules(13,13) && expected==currentContent())return {LoadError::None,version,true};
    if(version==19 && stamp==contentForRules(12,12) && expected==currentContent())return {LoadError::None,version,true};
    // Same schema/catalog: retain guests and the pending timer; future automatic
    // arrivals adopt the table-queue limit and small-cafe pacing.
    if(version==19 && stamp==contentForRules(11,11) && expected==currentContent())return {LoadError::None,version,true};
    if(version==18 && stamp==contentForRules(10,10) && expected==currentContent())return {LoadError::None,version,true};
    if(version==17 && stamp==contentForRules(9,9) && expected==currentContent())return {LoadError::None,version,true};
    if(version==16 && stamp==contentForRules(8,8) && expected==currentContent())return {LoadError::None,version,true};
    if(version==15 && stamp==contentForRules(7,7) && expected==currentContent())return {LoadError::None,version,true};
    // Explicit upgrade from the same catalog under the previous maintenance rules.
    if((version==14 || version==15) && stamp==contentForRules(6,6) && expected==currentContent())return {LoadError::None,version,true};
    if(version>=13 && version<=15 && stamp==equipmentContent && expected==currentContent())return {LoadError::None,version,true};
    if(version==10 && stamp==menuContent && expected==currentContent())return {LoadError::None,version,true};
    if(version==11 && stamp==staffContent && expected==currentContent())return {LoadError::None,version,true};
    if(version==12 && stamp==campaignContent && expected==currentContent())return {LoadError::None,version,true};
    if(!checked)return {checked.error==engine::simulator::Error::InvalidDefinition?LoadError::Malformed:checked.error==engine::simulator::Error::UnsupportedVersion?LoadError::ContentVersion:LoadError::ContentMismatch,version};
    return {LoadError::None,version,version<saveSchema};
}
} // namespace cafe
