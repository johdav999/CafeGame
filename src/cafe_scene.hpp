#pragma once
#include "engine/scene.hpp"
#include "engine/camera_component.hpp"
#include "engine/mesh_component.hpp"
#include "simulation.hpp"
#include "engine/ai.hpp"
#include "engine/simulator/travel.hpp"
namespace cafe {
class CafeScene final : public engine::Scene {
public:
    CafeScene();
    engine::CameraComponent& camera() { return *camera_; }
    void project(const Simulation& state);
    void travel(Simulation& state);
    void resetTravel();
    std::uint64_t pickStaff(float x,float y,float aspect,bool select);
    std::uint64_t selectedStaff();
    void clearStaffSelection();
    int moveSelectedStaff(const Simulation& state,int cell);
    bool guestAtCounter(const Simulation& state) const;
    struct GuestPin {std::uint64_t guest;float x,y;bool visible;float left,top,right,bottom;};
    std::vector<GuestPin> guestPins(float width,float height) const;
    std::array<float,2> positions() const;
    struct StaffAnimation {std::uint64_t worker;bool moving;double time;std::uint64_t poseRevision;float x,z,yaw;};
    std::vector<StaffAnimation> staffAnimations() const;
    struct GuestAnimation {std::uint64_t guest;std::string clip;double time;std::uint64_t poseRevision;float x,z,yaw;int model;};
    std::vector<GuestAnimation> guestAnimations() const;
    bool loadModel(int id,std::span<const std::byte> bytes);
    static constexpr std::size_t modelByteLimit(int id) {
        return std::size_t(id==1 || id==4 || (id>=12 && id<=14)?8:id==10 || id==11 || id==24?2:1)*1024*1024;
    }
    void cameraControl(int action,float x,float z);
    bool reducedMotion=false;
private:
    engine::CameraComponent* camera_ = nullptr;
    engine::MeshComponent* cup_ = nullptr;
    std::array<engine::MeshComponent*,2> products_{};
    struct StaffBinding {sim::WorkerId worker;engine::ActorId actor;sim::TaskId task{};std::uint64_t token=0;sim::JobId job{};sim::TravelBinding travel;bool returningHome=false;bool manualPosition=false;};
    std::vector<StaffBinding> workers_;
    engine::MeshComponent* grime_ = nullptr;
    engine::MeshComponent* fault_ = nullptr;
    engine::MeshComponent* machineBeans_ = nullptr;
    engine::MeshComponent* kettle_ = nullptr;
    engine::MeshComponent* milkJug_ = nullptr;
    std::array<engine::MeshComponent*,3> queueMarkers_{};
    std::array<engine::MeshComponent*,6> storageBags_{};
    std::array<engine::MeshComponent*,6> usedCups_{};
    engine::MeshComponent* counterFinish_=nullptr;
    engine::MeshComponent* countertop_=nullptr;
    struct CounterModule {engine::MeshComponent* mesh;int model;};
    std::vector<CounterModule> counterModules_;
    engine::MeshComponent* floorFinish_=nullptr;
    engine::MeshComponent* gardenFloor_=nullptr;
    engine::MeshComponent* gardenThreshold_=nullptr;
    bool gardenVisible_=false;
    std::array<engine::MeshComponent*,2> walls_{};
    std::array<engine::MeshComponent*,3> windowWalls_{};
    std::vector<engine::MeshComponent*> fallbackWindows_;
    engine::MeshComponent* machineBody_=nullptr;
    engine::MeshComponent* machineTrim_=nullptr;
    engine::MeshComponent* pastryDisplay_=nullptr;
    engine::MeshComponent* storageShelf_=nullptr;
    engine::MeshComponent* storageShelfSupplies_=nullptr;
    std::array<engine::MeshComponent*,2> storeroomShelves_{};
    std::array<engine::MeshComponent*,3> steam_{};
    float cameraAngle_=.695f,cameraElevation_=.51f,cameraDistance_=14.8f,panX_=0,panZ_=0;
    float mobileViewWidth_=0,mobileViewHeight_=0,mobileViewInset_=58;
    struct BuildPart {engine::MeshComponent* mesh;int key;engine::Vec3 position,scale;};
    std::vector<BuildPart> buildParts_;
    struct PlantVisual {engine::MeshComponent* pot=nullptr;engine::MeshComponent* foliage=nullptr;};
    std::array<PlantVisual,3> plantVisuals_{};
    engine::ActorId staff_, machine_;
    struct GuestBinding {sim::CustomerId customer;engine::ActorId actor;int phase=-1;std::size_t point=0;std::uint64_t token=0;};
    std::vector<GuestBinding> visitors_;
    sim::CustomerId guestCustomer_;
    std::shared_ptr<engine::WaypointGraph> staffPaths_;
    struct TablePart {engine::MeshComponent* mesh;engine::Vec3 position,scale;int model=-1,fallbackFor=-1;float yaw=0;};
    std::array<std::vector<TablePart>,6> tableParts_;
    std::vector<sim::Placement> projectedLayout_;
    bool layoutReady_=false;
    void syncLayout(const Simulation& state);
    engine::Vec3 seatPoint(const Simulation& state,std::size_t point,bool seated=false) const;
    engine::Vec3 cleaningPoint(const Simulation& state,std::size_t point,engine::Vec3 from) const;
    void route(engine::Actor& actor,engine::Vec3 goal);
    engine::MeshComponent& box(const char* name, engine::Vec3 position, engine::Vec3 scale, engine::Vec3 color);
};
}
