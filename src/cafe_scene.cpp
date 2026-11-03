#include "cafe_scene.hpp"
#include "engine/light_component.hpp"
#include "engine/skeletal_mesh_component.hpp"
#include "engine/interaction_component.hpp"
#include "engine/selection.hpp"
#include <cstdio>
#include <limits>
namespace cafe {
using namespace engine;
namespace {
std::array<std::shared_ptr<const Mesh>,30> localModels;
// Validated floor cells feed the existing engine graph, motor and follower.
class CafeWalker final : public Actor {
public:
    CharacterMotorComponent* motor;
    PathFollower follower;
    MeshComponent* body_;
    MeshComponent* cloth_;
    MeshComponent* head_;
    MeshComponent* model_;
    SkeletalMeshComponent* barista_=nullptr;
    std::size_t idleClip_=0,walkClip_=0,seatedClip_=0,activeClip_=0;
    bool moving_=false;
    bool seated_=false,working_=false;
    bool staffVisual_=false;
    int guestModel_=1;
    CafeWalker(std::string name, Vec3 position, Vec3 color):Actor(std::move(name)) {
        setTickEnabled(true);
        staffVisual_=this->name!="Guest";
        if(staffVisual_)addComponent<InteractionComponent>();
        CharacterMotorSettings settings;settings.collisionAware=false;
        motor=&addComponent<CharacterMotorComponent>("Walker motor",settings);
        transform.position=position;
        auto& body=motor->addChild<MeshComponent>("Apron",Mesh::cube());
        body_=&body;
        body.transform.position={0,.65f,0};body.transform.scale={.5f,.85f,.4f};body.color=color;
        auto& head=motor->addChild<MeshComponent>("Head",Mesh::sphere(12,8));
        head_=&head;
        head.transform.position={0,1.3f,0};head.transform.scale={.24f,.24f,.24f};head.color={.75f,.52f,.35f};
        cloth_=&motor->addChild<MeshComponent>("Cleaning cloth",Mesh::cube());
        cloth_->transform.position={.3f,.9f,-.25f};cloth_->transform.scale={.2f,.05f,.2f};cloth_->color={.85f,.72f,.3f};cloth_->enabled=false;
        model_=&motor->addChild<MeshComponent>("Local neighbor",Mesh::cube());model_->enabled=false;
        barista_=&motor->addChild<SkeletalMeshComponent>(staffVisual_?"Animated barista":"Animated guest");barista_->enabled=false;
        // Imported skin/clothing textures need a neutral multiplier; the engine
        // component's default color is blue, intended for untextured previews.
        barista_->color={1,1,1};
    }
    void cleaning(bool value) {cloth_->enabled=value;}
    void sit(bool value) {seated_=value;body_->transform.position.y=value?.9f:.65f;body_->transform.scale.y=value?.55f:.85f;}
    void working(bool value) {working_=value;}
    void face(Vec3 goal) {
        const auto m=worldMatrix();const float yaw=std::atan2(goal.x-m.m[12],goal.z-m.m[14]);
        barista_->transform.rotation.y=model_->transform.rotation.y=yaw;
        cloth_->transform.position={.2f*std::cos(yaw)+.35f*std::sin(yaw),.95f,-.2f*std::sin(yaw)+.35f*std::cos(yaw)};
    }
    void present() {
        const auto character=localModels[staffVisual_?4:localModels[guestModel_]?guestModel_:1];
        if(barista_ && character && character->skeleton) {
            auto& player=barista_->animation();
            if(barista_->mesh!=character) {
                barista_->mesh=character;
                const auto& clips=barista_->mesh->skeleton->clips;
                for(std::size_t i=0;i<clips.size();++i){if(clips[i].name=="Idle")idleClip_=i;if(clips[i].name=="Walking")walkClip_=i;if(clips[i].name=="Seated")seatedClip_=i;}
                barista_->animation().play(idleClip_);activeClip_=idleClip_;moving_=false;
            }
            barista_->enabled=true;model_->enabled=body_->enabled=head_->enabled=false;
            const auto velocity=motor->movementResult().velocity,command=motor->movementCommand().velocity;
            const bool moving=!seated_ && velocity.x*velocity.x+velocity.z*velocity.z>0.0001f && command.x*command.x+command.z*command.z>0.0001f;
            const auto clip=!staffVisual_ && seated_?seatedClip_:moving?walkClip_:idleClip_;
            if(clip!=activeClip_){player.crossFade(clip,.15);activeClip_=clip;}
            moving_=moving;
            if(moving)barista_->transform.rotation.y=std::atan2(velocity.x,velocity.z);
            return;
        }
        if(barista_)barista_->enabled=false;
        auto mesh=localModels[staffVisual_?(working_?3:4):seated_?2:1];model_->enabled=bool(mesh);body_->enabled=head_->enabled=!mesh;
        if(mesh){model_->mesh=mesh;model_->color=staffVisual_?Vec3{1,1,1}:Vec3{1,.93f,.86f};}
    }
    void walk(Vec3 goal) {follower.follow(std::array{goal});}
    void route(const std::vector<Vec3>& points) {follower.follow(points);}
    void stop() {follower.cancel(*motor);}
    void reset(Vec3 position) {stop();motor->teleport(position);}
protected:
    void fixedTick(double seconds) override {follower.step(*motor,seconds);}
    void onDisable() noexcept override {follower.cancel(*motor);}
};
// Keep the work surface near waist height for the authored character models.
constexpr float counterHeight=1.05f;
constexpr Vec3 staffHome{2,0,-3.4f}, machinePoint{-1.6f,0,-3.4f};
constexpr Vec3 entrance{5,0,-.8f}, counterPoint{1.2f,0,-.8f};
}
MeshComponent& CafeScene::box(const char* name, Vec3 position, Vec3 scale, Vec3 color) {
    auto& mesh = spawn(name).addComponent<MeshComponent>(name, Mesh::cube());
    mesh.transform.position = position;
    mesh.transform.scale = scale;
    auto material = std::make_shared<Material>();
    material->baseColor = color;
    mesh.setMaterial(0, MaterialInstance{material});
    return mesh;
}
CafeScene::CafeScene() : Scene("Morning at the cafe") {
    staff_=addChild<CafeWalker>("Barista",staffHome,Vec3{.25f,.4f,.3f}).id();
    machineBeans_=&box("Bean supplies",{2,1.6f,-2.2f},{.5f,.35f,.45f},{.6f,.42f,.2f});
    storeroomShelves_[0]=&box("Storeroom shelf",{4.5f,.65f,-4.5f},{1.8f,1.3f,.65f},{.43f,.3f,.18f});
    storeroomShelves_[1]=&box("Storeroom shelf extension",{4.95f,0,-4.5f},{1,1,1},{1,1,1});
    storeroomShelves_[1]->enabled=false;
    for(std::size_t i=0;i<storageBags_.size();++i) {
        storageBags_[i]=&box("Stored bean bag",{4.f+float(i%3)*.5f,1.5f+float(i/3)*.4f,-4.5f},{.38f,.35f,.4f},{.72f,.53f,.3f});
        storageBags_[i]->enabled=false;
    }
    ambient = {.3f, .27f, .23f};
    camera_ = &spawn("Cafe camera").addComponent<CameraComponent>();
    camera_->transform.position = {10, 9, 12};
    camera_->lookAt({0, 1, 0});
    cameraControl(0,0,0);
    SkyBackground backdrop;backdrop.horizon={.22f,.29f,.22f};backdrop.zenith={.10f,.16f,.13f};backdrop.nadir={.22f,.20f,.14f};setSky(backdrop);
    floorFinish_=&box("Oak floor", {0, -.15f, 0}, {12, .3f, 10}, {.43f, .28f, .17f});
    gardenFloor_=&box("Courtyard floor",{9,-.15f,0},{6,.3f,10},{.65f,.61f,.51f});gardenFloor_->enabled=false;
    gardenThreshold_=&box("Courtyard doorway threshold",{6,.015f,-.75f},{.5f,.03f,.5f},{.72f,.51f,.31f});gardenThreshold_->enabled=false;
    walls_[0]=&box("Cafe back wall", {0, 2, -5}, {12, 4, .2f}, {.4f, .52f, .4f});
    walls_[1]=&box("Cafe side wall", {-6, 2, 0}, {.2f, 4, 10}, {.8f, .73f, .58f});
    counterFinish_=&box("Service counter", {0, (counterHeight-.12f)*.5f, -2}, {6, counterHeight-.12f, 1.2f}, {.25f, .34f, .26f});
    countertop_=&box("Countertop", {0, counterHeight-.06f, -2}, {6.2f, .12f, 1.4f}, {.85f, .76f, .6f});
    for(float x:{-2.7f,-1.8f,-.6f,.6f,1.8f,2.7f}) {
        const bool corner=std::abs(x)>2.5f;
        auto& mesh=spawn("Modular service counter").addComponent<MeshComponent>("Counter module",Mesh::cube());
        mesh.transform.position={x,0,-2};mesh.transform.scale={corner?.6f/.65f:1.f,counterHeight/.9f,1.2f/.65f};
        mesh.color={1,1,1};mesh.enabled=false;counterModules_.push_back({&mesh,corner?7:6});
    }
    machineBody_=&box("Espresso machine", {-1.6f, counterHeight+.4f, -2.2f}, {1.3f, .8f, .7f}, {.15f, .17f, .16f});machine_=machineBody_->owner()->id();
    machineTrim_=&box("Machine brass trim", {-1.6f, counterHeight+.275f, -1.82f}, {1.1f, .14f, .08f}, {.75f, .5f, .2f});
    for(std::size_t i=0;i<steam_.size();++i){auto& puff=spawn("Gentle steam").addComponent<MeshComponent>("Steam",Mesh::sphere(8,6));puff.transform.scale={.07f,.1f,.07f};puff.color={.95f,.91f,.82f};puff.blend=BlendMode::Alpha;puff.opacity=.24f;puff.castsShadow=false;puff.enabled=false;steam_[i]=&puff;}
    grime_=&box("Machine residue",{-1.6f,counterHeight+.175f,-1.79f},{1.f,.07f,.1f},{.3f,.17f,.08f});
    fault_=&box("Machine service indicator",{-1.12f,counterHeight+.675f,-1.8f},{.1f,.1f,.08f},{.9f,.4f,.1f});
    grime_->enabled=fault_->enabled=false;
    // Engine picking follows the visible mesh, including loaded model variants.
    for(auto* mesh:{counterFinish_,countertop_,machineBody_,machineTrim_,grime_,fault_}) {
        mesh->owner()->addComponent<InteractionComponent>();
        mesh->owner()->addTag(mesh==counterFinish_ || mesh==countertop_?"prepare-counter":"prepare-machine");
    }
    for(auto& module:counterModules_) {
        module.mesh->owner()->addComponent<InteractionComponent>();
        module.mesh->owner()->addTag("prepare-counter");
    }
    cup_ = &box("Prepared coffee", {1.2f, counterHeight+.205f, -2}, {.22f, .35f, .22f}, {.93f, .87f, .72f});
    cup_->enabled = false;
    for(std::size_t n=0;n<products_.size();++n)products_[n]=&box("Prepared ticket item",{.6f+float(n)*.6f,counterHeight+.215f,-1.8f},{.25f,.35f,.25f},{.93f,.87f,.72f});
    kettle_=&box("Hot water kettle",{-.35f,counterHeight+.3f,-2.2f},{.45f,.6f,.45f},{.56f,.66f,.58f});
    milkJug_=&box("Milk steaming jug",{-2.65f,counterHeight+.225f,-2.2f},{.3f,.45f,.35f},{.75f,.72f,.65f});
    pastryDisplay_=&box("Pastry display",{2.5f,counterHeight+.15f,-2.1f},{.7f,.3f,.6f},{.72f,.5f,.28f});
    for(std::size_t n=0;n<queueMarkers_.size();++n)queueMarkers_[n]=&box("Queue position",{2.4f+float(n),.02f,-.8f},{.4f,.03f,.4f},{.72f,.6f,.32f});
    for(std::size_t i=0;i<6;++i) {
        auto part=[&](const char* name,Vec3 position,Vec3 scale,Vec3 color)->MeshComponent* {
            auto* mesh=&box(name,position,scale,color);tableParts_[i].push_back({mesh,position,scale});return mesh;
        };
        auto* top=part("Cafe table",{0,.95f,0},{1.05f,.10f,.9f},{.65f,.41f,.22f});top->mesh=Mesh::sphere(16,8);
        part("Table pedestal",{0,.45f,0},{.2f,.9f,.2f},{.16f,.2f,.16f});
        for(auto& primitive:tableParts_[i])primitive.fallbackFor=8;
        for(float z:{-1.3f,1.3f}) {
            const auto first=tableParts_[i].size();
            part("Chair seat",{0,.5f,z},{.85f,.15f,.8f},{.55f,.25f,.13f});
            part("Chair base",{0,.22f,z},{.55f,.45f,.55f},{.22f,.25f,.18f});
            auto* back=part("Rounded chair back",{0,.9f,z+(z<0?-.35f:.35f)},{.45f,.42f,.08f},{.56f,.65f,.54f});back->mesh=Mesh::sphere(12,8);
            for(auto n=first;n<tableParts_[i].size();++n)tableParts_[i][n].fallbackFor=9;
            auto& chair=spawn("Oak cafe chair").addComponent<MeshComponent>("Tripo chair",Mesh::cube());
            chair.color={1,1,1};chair.enabled=false;
            tableParts_[i].push_back({&chair,{0,0,z},{1,1,1},9,-1,z<0?0.f:3.14159265f});
        }
        auto& table=spawn("Oak cafe table").addComponent<MeshComponent>("Tripo table",Mesh::cube());
        table.color={1,1,1};table.enabled=false;
        tableParts_[i].push_back({&table,{0,0,0},{1,1,1},8});
        usedCups_[i]=part("Used cup",{0,1.14f,0},{.18f,.24f,.18f},{.9f,.83f,.65f});
        usedCups_[i]->enabled=false;
    }
    plantVisuals_[0].pot=&box("Plant pot", {-4.5f, .4f, -3.7f}, {.65f, .8f, .65f}, {.6f, .28f, .15f});
    auto& leaves = spawn("Plant foliage").addComponent<MeshComponent>("Leaves", Mesh::sphere(12, 8));
    leaves.transform.position = {-4.5f, 1.25f, -3.7f};
    leaves.transform.scale = {.7f, 1, .7f};
    leaves.color = {.22f, .43f, .18f};
    plantVisuals_[0].foliage=&leaves;
    auto finishMaterial=std::make_shared<Material>();finishMaterial->baseColor={1,1,1};
    for(auto* mesh:{floorFinish_,counterFinish_,machineBody_})mesh->setMaterial(0,MaterialInstance{finishMaterial});
    for(int key=1;key<8;++key) {
        auto part=[&](const char* name,Vec3 pos,Vec3 scale,Vec3 color){auto* mesh=&box(name,pos,scale,color);buildParts_.push_back({mesh,key,pos,scale});mesh->enabled=false;};
        if(key==7){part("Cold preparation worktop",{0,.6f,0},{1.3f,1.2f,.8f},{.25f,.4f,.3f});part("Cold preparation tray",{0,1.22f,0},{1.3f,.04f,.8f},{.85f,.76f,.6f});}
        else if(key==1){part("Extra preparation bench",{0,.6f,0},{1.3f,1.2f,.8f},{.25f,.4f,.3f});part("Second espresso head",{0,1.5f,0},{.8f,.6f,.55f},{.2f,.24f,.2f});}
        else if(key==2){part("Extra storage shelf",{0,.8f,0},{.85f,1.6f,.8f},{.6f,.4f,.22f});storageShelf_=buildParts_.back().mesh;part("Extra shelf supplies",{0,1.7f,0},{.7f,.3f,.6f},{.8f,.7f,.5f});storageShelfSupplies_=buildParts_.back().mesh;}
        else if(key<=4){part("Decorative plant pot",{0,.25f,0},{.35f,.5f,.35f},key==3?Vec3{.56f,.65f,.54f}:Vec3{.77f,.46f,.34f});plantVisuals_[key-2].pot=buildParts_.back().mesh;part("Decorative foliage",{0,.75f,0},{.5f,.6f,.5f},{.3f,.5f,.32f});plantVisuals_[key-2].foliage=buildParts_.back().mesh;}
        else {part("Lamp stand",{0,.8f,0},{.08f,1.6f,.08f},{.7f,.5f,.25f});part("Lamp shade",{0,1.65f,0},{.45f,.3f,.45f},key==5?Vec3{.84f,.67f,.36f}:Vec3{.14f,.24f,.2f});}
    }
    auto& sun = spawn("Morning sunlight").addComponent<LightComponent>("Sun", LightType::Directional);
    sun.direction = {-.4f, -1, -.2f};
    sun.color = {1, .87f, .67f};
    sun.intensity = 2;
    // Tall, quiet window panes and oak mullions behind the service area.
    for(float x:{-3.8f,0.f,3.8f}){fallbackWindows_.push_back(&box("Morning window",{x,2.6f,-4.86f},{2.6f,1.9f,.04f},{.78f,.85f,.79f}));fallbackWindows_.push_back(&box("Window mullion",{x,2.6f,-4.8f},{.06f,1.95f,.06f},{.72f,.51f,.31f}));}
    for(std::size_t n=0;n<windowWalls_.size();++n){windowWalls_[n]=&box("Tripo window wall",{-4.f+4.f*float(n),0,-5},{1,1,1},{1,1,1});windowWalls_[n]->enabled=false;}
}
bool CafeScene::loadModel(int id,std::span<const std::byte> bytes) {
    if(id<0 || std::size_t(id)>=localModels.size() || bytes.empty() || bytes.size()>modelByteLimit(id))return false;
    try {auto candidate=GlbImporter::loadMemory(bytes);if(!candidate || candidate->vertices.empty())return false;
        if(id==4 || id==1 || (id>=12 && id<=14)) {
            if(!candidate->skeleton || candidate->skin.size()!=candidate->vertices.size())return false;
            bool idle=false,walk=false,seated=false;
            for(const auto& clip:candidate->skeleton->clips){idle|=clip.name=="Idle" && clip.duration>0;walk|=clip.name=="Walking" && clip.duration>0;seated|=clip.name=="Seated" && clip.duration>0;}
            if(!idle || !walk || (id!=4 && !seated))return false;
        }
        localModels[std::size_t(id)]=candidate;
        if(id>=25 && id<=29) {
            auto bind=[&](MeshComponent* mesh,Vec3 position) {
                mesh->mesh=candidate;mesh->materialOverrides.clear();mesh->color={1,1,1};
                mesh->transform.position=position;mesh->transform.scale={1,1,1};
            };
            if(id==25)bind(kettle_,{-.35f,counterHeight+.005f,-2.2f});
            if(id==26)bind(milkJug_,{-2.65f,counterHeight+.005f,-2.2f});
            if(id==27)bind(machineBeans_,{2,counterHeight+.005f,-2.2f});
            if(id==28)for(std::size_t n=0;n<storageBags_.size();++n)
                bind(storageBags_[n],{4.f+float(n%3)*.5f,(localModels[23]?1.6f:1.325f)+float(n/3)*.35f,-4.5f});
            if(id==29)for(std::size_t n=0;n<queueMarkers_.size();++n) {
                bind(queueMarkers_[n],{2.4f+float(n),.006f,-.8f});
                queueMarkers_[n]->castsShadow=false;
            }
        }
        if(id==24) {
            for(auto* bay:windowWalls_){bay->mesh=candidate;bay->materialOverrides.clear();bay->color={1,1,1};bay->enabled=true;}
            walls_[0]->enabled=false;for(auto* pane:fallbackWindows_)pane->enabled=false;
        }
        if(id==23) {
            for(std::size_t n=0;n<storeroomShelves_.size();++n){auto* shelf=storeroomShelves_[n];shelf->mesh=candidate;shelf->materialOverrides.clear();shelf->color={1,1,1};shelf->transform.position={4.05f+float(n)*.9f,0,-4.5f};shelf->transform.scale={1,1,1};shelf->enabled=true;}
            for(std::size_t n=0;n<storageBags_.size();++n)storageBags_[n]->transform.position.y=(localModels[28]?1.6f:1.775f)+float(n/3)*.35f;
        }
        if(id==22){pastryDisplay_->mesh=candidate;pastryDisplay_->materialOverrides.clear();pastryDisplay_->color={1,1,1};pastryDisplay_->transform.position={2.5f,counterHeight+.005f,-2.1f};pastryDisplay_->transform.scale={1,1,1};}
        if(id==0){machineBody_->mesh=candidate;machineBody_->materialOverrides.clear();machineBody_->transform.position={-1.6f,counterHeight+.005f,-2.2f};machineBody_->transform.scale={1,1,1};machineTrim_->enabled=false;}
        layoutReady_=false;
        if(id==6 || id==7)for(auto& module:counterModules_)if(module.model==id)module.mesh->mesh=candidate;
        if(id==10) {
            for(auto* wall:walls_){wall->mesh=candidate;wall->materialOverrides.clear();wall->color={1,1,1};}
            walls_[0]->transform.position={0,0,-5};walls_[0]->transform.scale={4,4.f/3,1};
            walls_[1]->transform.position={-6,0,0};walls_[1]->transform.scale={10.f/3,4.f/3,1};walls_[1]->transform.rotation.y=1.57079633f;
        }
        if(id==11) {
            floorFinish_->mesh=candidate;floorFinish_->materialOverrides.clear();
            // One continuous slab avoids tile gaps and overlapping coplanar faces.
            floorFinish_->transform.position={0,-.3f,0};floorFinish_->transform.scale={4,2.5f,10.f/3};
            gardenFloor_->mesh=candidate;gardenFloor_->materialOverrides.clear();gardenFloor_->color={.9f,.94f,.84f};
            gardenFloor_->transform.position={9,-.3f,0};gardenFloor_->transform.scale={2,2.5f,10.f/3};
        }
        return true;
    }catch(const std::exception& error){std::fprintf(stderr,"Cafe model %d: %s\n",id,error.what());return false;}
}
void CafeScene::cameraControl(int action,float x,float z) {
    if(!std::isfinite(x) || !std::isfinite(z))return;
    // Landscape HUD overlays the scene; portrait HUD occupies separate rows.
    if(action==4 || action==5){if(x<=0 || z<=0)return;mobileViewWidth_=x;mobileViewHeight_=z;mobileViewInset_=action==4?(z>600?114.f:58.f):12.f;action=0;}
    if(action==0){cameraAngle_=.695f;cameraElevation_=mobileViewWidth_>0?.45f:.51f;cameraDistance_=gardenVisible_?21.f:14.8f;panX_=gardenVisible_?2.5f:0;panZ_=0;}
    if(action==1){cameraAngle_=std::clamp(cameraAngle_+x,.12f,1.4f);cameraElevation_=std::clamp(cameraElevation_+z,.45f,1.15f);}
    if(action==2){panX_=std::clamp(panX_+x,-2.5f,gardenVisible_?8.f:2.5f);panZ_=std::clamp(panZ_+z,-2.f,2.f);}
    if(action==3)cameraDistance_=std::clamp(cameraDistance_+x,mobileViewWidth_>0?8.5f:11.f,gardenVisible_?30.f:24.f);
    const float targetHeight=mobileViewWidth_>0?-.35f:1.f;
    const auto placeCamera=[&]{
        camera_->transform.position={panX_+cameraDistance_*std::sin(cameraAngle_)*std::cos(cameraElevation_),targetHeight+cameraDistance_*std::sin(cameraElevation_),panZ_+cameraDistance_*std::cos(cameraAngle_)*std::cos(cameraElevation_)};
        camera_->lookAt({panX_,targetHeight,panZ_});
    };
    // Fit the real floor and wall edges inside the mobile HUD, using the same
    // public camera projection as rendering, guest pins and pointer picking.
    if(action==0 && mobileViewWidth_>0){
        const float right=gardenVisible_?12.f:6.f;
        const std::array<Vec3,7> edges={Vec3{-6,0,-5},{right,0,-5},{right,0,5},{-6,0,5},{-6,4,-5},{6,4,-5},{-6,4,5}};
        for(cameraDistance_=11.f;cameraDistance_<30.f;cameraDistance_+=.1f){
            placeCamera();bool fits=true;
            for(auto edge:edges){
                const auto p=camera_->worldToScreen(edge,{0,0,mobileViewWidth_,mobileViewHeight_});
                if(!p.inFront || p.pixel.x<12 || p.pixel.x>mobileViewWidth_-12 || p.pixel.y<mobileViewInset_ || p.pixel.y>mobileViewHeight_-mobileViewInset_){fits=false;break;}
            }
            if(fits)break;
        }
        // Mobile play prioritizes readable service areas over the empty outer
        // floor border. Keep the fitted view as a baseline, then move closer.
        cameraDistance_=std::max(8.5f,cameraDistance_*.75f);
    }
    placeCamera();
}
Vec3 CafeScene::seatPoint(const Simulation& state,std::size_t point,bool seated) const {
    auto p=state.tablePlacement(point);if(!p)throw std::runtime_error("Seat has no table");
    if(seated) {
        auto r=sim::GridLayout::footprint(*p);float x=0,z=1.3f;
        for(int turn=0;turn<p->rotation;++turn){float previous=x;x=-z;z=previous;}
        return {-6.f+(float(r.x)+float(r.width)*.5f)*.5f+x,0,-5.f+(float(r.z)+float(r.depth)*.5f)*.5f+z};
    }
    auto c=sim::GridLayout::access(*p);return {-6.f+(float(c.x)+.5f)*.5f,0,-5.f+(float(c.z)+.5f)*.5f};
}
Vec3 CafeScene::cleaningPoint(const Simulation& state,std::size_t point,Vec3 from) const {
    auto p=state.tablePlacement(point);if(!p)throw std::runtime_error("Cleaning task has no table");
    const auto r=sim::GridLayout::footprint(*p);
    const Vec3 center{-6.f+(float(r.x)+float(r.width)*.5f)*.5f,0,-5.f+(float(r.z)+float(r.depth)*.5f)*.5f};
    auto start=staffPaths_->nearest(from,100);
    Vec3 best=center;float bestCost=std::numeric_limits<float>::infinity();
    // The long ends contain chairs. Use a free cell beside the tabletop,
    // rotating the approach with the complete table set and checking its route.
    for(float side:{-1.f,1.f})for(float along:{-.25f,.25f}) {
        float x=side*1.25f,z=along;
        for(int turn=0;turn<p->rotation;++turn){float previous=x;x=-z;z=previous;}
        const Vec3 goal{center.x+x,0,center.z+z};
        auto end=staffPaths_->nearest(goal,.01f);if(!start || !end)continue;
        auto path=staffPaths_->findPath(*start,*end);if(path.status!=PathStatus::Complete)continue;
        float cost=0;Vec3 previous=from;
        for(auto next:path.points){cost+=std::hypot(next.x-previous.x,next.z-previous.z);previous=next;}
        if(cost<bestCost){bestCost=cost;best=goal;}
    }
    // No side approach means routing fails through the existing blocked-task
    // handling, rather than sending the cleaner back to the guest's chair.
    return best;
}
void CafeScene::syncLayout(const Simulation& state) {
    auto projected=state.layout.placements();
    for(auto p:state.gardenLayout.placements()){p.x+=24;projected.push_back(p);}
    if(layoutReady_ && projectedLayout_==projected && gardenVisible_==state.courtyardOpen())return;
    if(gardenVisible_!=state.courtyardOpen()){gardenVisible_=state.courtyardOpen();cameraControl(0,0,0);}
    gardenFloor_->enabled=gardenThreshold_->enabled=gardenVisible_;
    projectedLayout_=std::move(projected);layoutReady_=true;
    std::vector<Vec3> points;std::vector<WaypointEdge> edges;std::array<int,720> indices;indices.fill(-1);
    for(int z=0;z<20;++z)for(int x=0;x<24;++x)if(!state.layout.blocked({x,z})) {
        indices[std::size_t(z*24+x)]=int(points.size());points.push_back({-6.f+(float(x)+.5f)*.5f,0,-5.f+(float(z)+.5f)*.5f});
    }
    for(int z=0;z<20;++z)for(int x=0;x<24;++x) {
        int from=indices[std::size_t(z*24+x)];if(from<0)continue;
        for(auto delta:std::array{sim::GridCell{1,0},sim::GridCell{0,1},sim::GridCell{1,1},sim::GridCell{-1,1}})if(x+delta.x>=0 && x+delta.x<24 && z+delta.z<20) {
            // Diagonals must clear both adjacent cells so walkers cannot cut
            // through the corners of tables, counters or other furniture.
            if(delta.x && delta.z && (indices[std::size_t(z*24+x+delta.x)]<0 || indices[std::size_t((z+delta.z)*24+x)]<0))continue;
            int to=indices[std::size_t((z+delta.z)*24+x+delta.x)];
            if(to>=0){edges.push_back({std::uint32_t(from),std::uint32_t(to)});edges.push_back({std::uint32_t(to),std::uint32_t(from)});}
        }
    }
    if(gardenVisible_) {
        for(int z=0;z<garden::depth;++z)for(int x=0;x<garden::width;++x)if(!state.gardenLayout.blocked({x,z})) {
            indices[480+std::size_t(z*12+x)]=int(points.size());points.push_back({6.f+(float(x)+.5f)*.5f,0,-5.f+(float(z)+.5f)*.5f});
        }
        for(int z=0;z<garden::depth;++z)for(int x=0;x<garden::width;++x) {
            int from=indices[480+std::size_t(z*12+x)];if(from<0)continue;
            for(auto delta:std::array{sim::GridCell{1,0},sim::GridCell{0,1},sim::GridCell{1,1},sim::GridCell{-1,1}})if(x+delta.x>=0 && x+delta.x<12 && z+delta.z<20) {
                if(delta.x && delta.z && (indices[480+std::size_t(z*12+x+delta.x)]<0 || indices[480+std::size_t((z+delta.z)*12+x)]<0))continue;
                int to=indices[480+std::size_t((z+delta.z)*12+x+delta.x)];
                if(to>=0){edges.push_back({std::uint32_t(from),std::uint32_t(to)});edges.push_back({std::uint32_t(to),std::uint32_t(from)});}
            }
        }
        int from=indices[std::size_t(garden::doorZ*24+23)],to=indices[480+std::size_t(garden::doorZ*12)];
        if(from>=0 && to>=0){edges.push_back({std::uint32_t(from),std::uint32_t(to)});edges.push_back({std::uint32_t(to),std::uint32_t(from)});}
    }
    staffPaths_=std::make_shared<WaypointGraph>(std::move(points),std::move(edges));
    for(std::size_t i=0;i<6;++i) {
        auto found=std::find_if(projectedLayout_.begin(),projectedLayout_.end(),[&](auto p){return p.id==(i<4?i+1:101+i-4);});
        const auto* p=found==projectedLayout_.end()?nullptr:&*found;
        for(auto part:tableParts_[i]) {
            part.mesh->enabled=bool(p) && (part.model<0 || bool(localModels[part.model])) && (part.fallbackFor<0 || !localModels[part.fallbackFor]);if(!p)continue;
            if(part.model>=0 && localModels[part.model])part.mesh->mesh=localModels[part.model];
            auto r=sim::GridLayout::footprint(*p);float x=part.position.x,z=part.position.z;
            for(int turn=0;turn<p->rotation;++turn){float previous=x;x=-z;z=previous;}
            part.mesh->transform.position={-6.f+(float(r.x)+float(r.width)*.5f)*.5f+x,part.position.y,-5.f+(float(r.z)+float(r.depth)*.5f)*.5f+z};
            part.mesh->transform.scale=p->rotation%2?Vec3{part.scale.z,part.scale.y,part.scale.x}:part.scale;
            if(part.model>=0){part.mesh->transform.scale=part.scale;part.mesh->transform.rotation.y=part.yaw-float(p->rotation)*1.57079633f;}
            if(part.mesh==usedCups_[i] && localModels[5]) {
                part.mesh->mesh=localModels[5];part.mesh->materialOverrides.clear();part.mesh->color={1,1,1};
                part.mesh->transform.position.y=1.01f;part.mesh->transform.scale={2.8f,2.8f,2.8f};
            }
        }
    }
}
void CafeScene::route(Actor& actor,Vec3 goal) {
    auto& walker=dynamic_cast<CafeWalker&>(actor);auto m=actor.worldMatrix();
    auto from=staffPaths_->nearest({m.m[12],m.m[13],m.m[14]},100),to=staffPaths_->nearest(goal,.6f);
    auto path=from && to?staffPaths_->findPath(*from,*to):WaypointPath{};
    if(path.status==PathStatus::Complete)walker.route(path.points);else walker.stop();
}
void CafeScene::project(const Simulation& state) {
    syncLayout(state);
    for(auto& w:workers_)if(auto* walker=dynamic_cast<CafeWalker*>(findActor(w.actor)))walker->present();
    for(auto& g:visitors_)if(auto* walker=dynamic_cast<CafeWalker*>(findActor(g.actor)))walker->present();
    for(std::size_t i=0;i<steam_.size();++i){steam_[i]->enabled=state.brewing>0;float t=reducedMotion?float(i)/3:std::fmod(float(state.runtime->time())/1800+float(i)/3,1.f);steam_[i]->transform.position={-1.6f+.12f*std::sin(t*5),counterHeight+.575f+t*.6f,-1.95f};}
    counterFinish_->color=state.finish==1?Vec3{.95f,.91f,.82f}:state.finish==2?Vec3{.72f,.51f,.31f}:state.finish==3?Vec3{.45f,.57f,.38f}:Vec3{.14f,.24f,.2f};
    const bool countersReady=localModels[6] && localModels[7];
    counterFinish_->enabled=countertop_->enabled=!countersReady;
    for(auto& module:counterModules_) {
        module.mesh->enabled=countersReady;
        module.mesh->color=state.finish==0?Vec3{1,1,1}:counterFinish_->color;
        // Alternative finishes use a per-instance paint override; the shared asset stays intact.
        if(state.finish && countersReady){MaterialInstance paint;paint.baseColorTexture=std::shared_ptr<const Texture>{};module.mesh->setMaterial(0,paint);}
        else module.mesh->materialOverrides.clear();
    }
    machineBody_->color=localModels[0]?(state.fastMachine?Vec3{1,.88f,.65f}:Vec3{1,1,1}):(state.fastMachine?Vec3{.65f,.48f,.23f}:Vec3{.15f,.17f,.16f});
    floorFinish_->color=localModels[11]?(state.finish==1?Vec3{1,.96f,.86f}:state.finish==2?Vec3{1,.9f,.75f}:Vec3{1,1,1}):(state.finish==1?Vec3{.7f,.62f,.49f}:state.finish==2?Vec3{.72f,.51f,.31f}:Vec3{.43f,.28f,.17f});
    for(auto part:buildParts_) {
        auto p=state.layout.find(Simulation::buildItems[std::size_t(part.key)].id);part.mesh->enabled=bool(p);if(!p)continue;
        auto r=sim::GridLayout::footprint(*p);float x=part.position.x,z=part.position.z;
        for(int turn=0;turn<p->rotation;++turn){float old=x;x=-z;z=old;}
        part.mesh->transform.position={-6.f+(float(r.x)+float(r.width)*.5f)*.5f+x,part.position.y,-5.f+(float(r.z)+float(r.depth)*.5f)*.5f+z};
        part.mesh->transform.scale=p->rotation%2?Vec3{part.scale.z,part.scale.y,part.scale.x}:part.scale;
        if(part.key==2 && localModels[23]) {
            if(part.mesh==storageShelfSupplies_){part.mesh->enabled=false;continue;}
            storageShelf_->mesh=localModels[23];storageShelf_->materialOverrides.clear();storageShelf_->color={1,1,1};
            storageShelf_->transform.position.y=0;storageShelf_->transform.scale={1,1,1};
            storageShelf_->transform.rotation.y=-float(p->rotation)*1.57079633f;
        }
    }
    for(std::size_t n=0;n<plantVisuals_.size();++n) {
        const int plant=n?state.plantStyles[n-1]:1,pot=n?state.potStyles[n-1]:1;
        auto& visual=plantVisuals_[n];
        const auto foliage=localModels[15+plant],container=localModels[19+pot];
        if(!foliage || !container)continue;
        Vec3 anchor{-4.5f,0,-3.7f};float size=1.8f,yaw=0;
        if(n) {
            auto p=state.layout.find(19+n);if(!p)continue;
            anchor={-6.f+(float(p->x)+.5f)*.5f,0,-5.f+(float(p->z)+.5f)*.5f};size=1;
            yaw=-float(p->rotation)*1.57079633f;
        }
        visual.pot->mesh=container;visual.foliage->mesh=foliage;
        for(auto* mesh:{visual.pot,visual.foliage}) {
            mesh->materialOverrides.clear();mesh->color={1,1,1};mesh->transform.scale={size,size,size};mesh->transform.rotation.y=yaw;
        }
        visual.pot->transform.position=anchor;
        visual.foliage->transform.position=anchor+Vec3{0,.275f*size,0};
    }
    auto condition=state.machineCondition.snapshot();grime_->enabled=condition.cleanliness<800;fault_->enabled=condition.integrity<300;
    cup_->enabled = false;
    for(std::size_t n=0;n<products_.size();++n) {
        const auto& item=state.items[n];auto* mesh=products_[n];
        mesh->enabled=state.active() && item.product>=0 && item.madeAt>=0;
        mesh->transform.scale=(item.product==4 || item.product==7)?Vec3{.42f,.14f,.24f}:item.product==2?Vec3{.28f,.45f,.28f}:Vec3{.25f,.3f,.25f};
        // Component tint is projected per instance; shared assets remain immutable.
        mesh->color=(item.product==4 || item.product==7)?Vec3{.78f,.5f,.22f}:item.product==3?Vec3{.55f,.69f,.48f}:Vec3{.93f,.87f,.72f};
        mesh->materialOverrides.clear();
        if(localModels[5] && item.product>=0 && (item.product<4 || item.product==5 || item.product==6)) {
            mesh->mesh=localModels[5];mesh->color={1,1,1};
            const float size=item.product==2?4.6f:3.7f;
            mesh->transform.scale={size,size,size};mesh->transform.position.y=counterHeight+.005f;
        }else{mesh->mesh=Mesh::cube();mesh->transform.position.y=counterHeight+.215f;}
    }
    machineBeans_->enabled=state.stock>0 || state.inputHeld>0;
    auto stored=state.storedBeans().total;
    for(std::size_t i=0;i<storageBags_.size();++i)storageBags_[i]->enabled=stored>std::int64_t(i*4);
    for(auto* cup:usedCups_)cup->enabled=false;
    for(const auto& g:state.guests)if(g.cleanup) {auto c=state.seats.claim(g.id);if(c && c->point<6)usedCups_[c->point]->enabled=true;}
}
void CafeScene::resetTravel() {
    clearStaffSelection();
    guestCustomer_={};
    for(const auto& w:workers_){if(auto* actor=findActor(w.actor))actor->destroy();if(w.actor==staff_)staff_={};}
    workers_.clear();if(auto* actor=findActor(staff_))actor->destroy();staff_={};
    for(auto& g:visitors_)if(auto* actor=findActor(g.actor))actor->destroy();
    visitors_.clear();

}
std::array<float,2> CafeScene::positions() const {
    auto* staff=findActor(staff_);const Actor* guest=nullptr;
    for(const auto& g:visitors_)if(g.customer==guestCustomer_)guest=findActor(g.actor);
    return {staff?staff->worldMatrix().m[12]:0,guest?guest->worldMatrix().m[12]:0};
}
std::uint64_t CafeScene::pickStaff(float x,float y,float aspect,bool select) {
    SelectionQuery query;query.geometry=SelectionGeometry::Triangles;query.occlusion=true;
    auto hit=selection().resolvePointer({x*aspect,y},camera(),{0,0,aspect,1},query);
    if(hit)for(const auto& w:workers_)if(w.actor==hit->actor) {
        if(select)selection().select(w.actor);
        return w.worker.value;
    }
    return 0;
}
std::uint64_t CafeScene::selectedStaff() {
    for(const auto& w:workers_)if(w.actor==selection().selected())return w.worker.value;
    return 0;
}
void CafeScene::clearStaffSelection() {selection().clear();}
int CafeScene::moveSelectedStaff(const Simulation& state,int cell) {
    // Manual travel is transient, like other scene routes. Work always takes priority.
    for(auto& w:workers_)if(w.actor==selection().selected()) {
        if(state.tasks->current(w.worker))return 3;
        const bool outdoor=cell>=480;
        if(cell<0 || cell>=720 || (outdoor?(!state.courtyardOpen() || state.gardenLayout.blocked({(cell-480)%12,(cell-480)/12})):state.layout.blocked({cell%24,cell/24})))return 4;
        auto* walker=dynamic_cast<CafeWalker*>(findActor(w.actor));if(!walker)return 4;
        syncLayout(state);
        const auto m=walker->worldMatrix();
        auto from=staffPaths_->nearest({m.m[12],0,m.m[14]},100);
        const Vec3 goal{outdoor?6.f+(float((cell-480)%12)+.5f)*.5f:-6.f+(float(cell%24)+.5f)*.5f,0,-5.f+(float(outdoor?(cell-480)/12:cell/24)+.5f)*.5f};
        auto to=staffPaths_->nearest(goal,.01f);
        auto path=from && to?staffPaths_->findPath(*from,*to):WaypointPath{};
        if(path.status!=PathStatus::Complete)return 4;
        walker->route(path.points);w.task={};w.token=0;w.job={};w.travel.clear();
        w.manualPosition=true;w.returningHome=false;return 2;
    }
    return 0;
}
std::vector<CafeScene::StaffAnimation> CafeScene::staffAnimations() const {
    std::vector<StaffAnimation> result;
    for(const auto& binding:workers_)if(auto* actor=dynamic_cast<const CafeWalker*>(findActor(binding.actor))) {
        if(!actor->barista_ || !actor->barista_->enabled)continue;
        auto& mesh=*actor->barista_;auto& player=mesh.animation();const auto m=actor->worldMatrix();
        const auto pose=mesh.skinPose();
        result.push_back({binding.worker.value,actor->moving_,player.time(),pose?pose->revision:0,m.m[12],m.m[14],mesh.transform.rotation.y});
    }
    return result;
}
std::vector<CafeScene::GuestAnimation> CafeScene::guestAnimations() const {
    std::vector<GuestAnimation> result;
    for(const auto& binding:visitors_)if(auto* actor=dynamic_cast<const CafeWalker*>(findActor(binding.actor))) {
        if(!actor->barista_ || !actor->barista_->enabled)continue;
        auto& mesh=*actor->barista_;const auto m=actor->worldMatrix();const auto pose=mesh.skinPose();
        result.push_back({binding.customer.value,actor->seated_?"Seated":actor->moving_?"Walking":"Idle",mesh.animation().time(),pose?pose->revision:0,m.m[12],m.m[14],mesh.transform.rotation.y,localModels[actor->guestModel_]?actor->guestModel_:1});
    }
    return result;
}
bool CafeScene::guestAtCounter(const Simulation& state) const {
    auto claim=state.counter.claim(state.customer);return claim && claim->occupied;
}
std::vector<CafeScene::GuestPin> CafeScene::guestPins(float width,float height) const {
    std::vector<GuestPin> result;
    if(width<1 || height<1)return result;
    result.reserve(visitors_.size());
    for(const auto& binding:visitors_)if(auto* actor=findActor(binding.actor)) {
        if(!actor->isActiveInHierarchy())continue;
        const auto m=actor->worldMatrix();
        auto point=camera_->worldToScreen({m.m[12],m.m[13]+1.9f,m.m[14]},{0,0,width,height});
        // Conservative character envelope, projected through the public camera API.
        // Include the full standing height even while seated or animating.
        float left=point.pixel.x,right=left,top=point.pixel.y,bottom=top;
        for(float dx:{-.45f,.45f})for(float dy:{0.f,1.9f})for(float dz:{-.45f,.45f}) {
            const auto corner=camera_->worldToScreen({m.m[12]+dx,m.m[13]+dy,m.m[14]+dz},{0,0,width,height});
            left=std::min(left,corner.pixel.x);right=std::max(right,corner.pixel.x);
            top=std::min(top,corner.pixel.y);bottom=std::max(bottom,corner.pixel.y);
        }
        result.push_back({binding.customer.value,point.pixel.x,point.pixel.y,point.visible,left,top,right,bottom});
    }
    return result;
}
void CafeScene::travel(Simulation& state) {
    syncLayout(state);
    for(auto i=workers_.begin();i!=workers_.end();) {
        if(!state.member(i->worker)){if(auto* actor=findActor(i->actor))actor->destroy();if(i->actor==staff_)staff_={};i=workers_.erase(i);}else ++i;
    }
    for(const auto& w:state.crew)if(std::none_of(workers_.begin(),workers_.end(),[&](const auto& b){return b.worker==w.id;})) {
        auto actor=workers_.empty() && staff_?staff_:addChild<CafeWalker>(Simulation::staffName(w.name),Vec3{2.f+float(w.name)*.65f,0,-3.4f},Vec3{.25f+float(w.name)*.08f,.4f,.3f}).id();
        workers_.push_back({w.id,actor});
    }
    for(const auto& b:workers_)if(b.worker==state.staff)staff_=b.actor;
    guestCustomer_=state.customer;
    for(auto i=visitors_.begin();i!=visitors_.end();) {
        if(!state.guest(i->customer) || state.guest(i->customer)->hasDeparted) {if(auto* actor=findActor(i->actor))actor->destroy();i=visitors_.erase(i);}
        else ++i;
    }
    for(const auto& g:state.guests) {
        if(g.hasDeparted)continue;
        auto found=std::find_if(visitors_.begin(),visitors_.end(),[&](const auto& b){return b.customer==g.id;});
        if(found==visitors_.end()) {
            auto& actor=addChild<CafeWalker>("Guest",entrance,Vec3{.55f+.04f*float(g.id.value%3),.3f,.2f});
            // Presentation is stable across scene rebuilds and save/load without new save state.
            constexpr std::array guestModels{1,12,13,14};
            actor.guestModel_=guestModels[g.regular>=3?std::size_t(g.regular-2)%guestModels.size():(g.id.value-1)%guestModels.size()];
            visitors_.push_back({g.id,actor.id()});
        }
    }
    std::vector<sim::CustomerId> departed;
    for(auto& b:visitors_) {
        auto* guest=dynamic_cast<CafeWalker*>(findActor(b.actor));auto* g=state.guest(b.customer);
        if(!g)continue;
        if(!guest || !guest->isActiveInHierarchy()) {state.leave(g->id);departed.push_back(g->id);continue;}
        auto phase=g->phase;guest->sit(phase==Simulation::GuestPhase::Dining);
        const auto* pool=phase==Simulation::GuestPhase::Queue?&state.queue:phase==Simulation::GuestPhase::Counter?&state.counter:&state.seats;
        auto claim=pool->claim(g->id);
        const auto point=claim?claim->point:Simulation::Pool::waiting;
        if(phase==Simulation::GuestPhase::Dining && point!=Simulation::Pool::waiting)
            if(auto placement=state.tablePlacement(point))guest->barista_->transform.rotation.y=3.14159265f-float(placement->rotation)*1.57079633f;
        const auto token=claim?claim->token:0;
        if(b.phase!=int(phase) || b.point!=point || b.token!=token) {
            // Sitting projects inside the furniture; walking starts at its free access cell.
            if(phase==Simulation::GuestPhase::Leaving && b.phase==int(Simulation::GuestPhase::Dining) && b.point!=Simulation::Pool::waiting)
                guest->reset(seatPoint(state,b.point));
            b.phase=int(phase);b.point=point;b.token=token;
            Vec3 goal=entrance;
            if(phase==Simulation::GuestPhase::Queue)goal={2.4f+float(point),0,-.8f};
            else if(phase==Simulation::GuestPhase::Counter)goal=counterPoint;
            else if(phase==Simulation::GuestPhase::ToSeat || phase==Simulation::GuestPhase::Dining) {
                if(point==Simulation::Pool::waiting) {
                    auto index=std::find_if(state.seats.claims().begin(),state.seats.claims().end(),[&](const auto& c){return c.owner==g->id;})-state.seats.claims().begin();
                    goal={-.5f-.65f*float(index),0,-.8f};
                } else goal=seatPoint(state,point,phase==Simulation::GuestPhase::Dining);
            }
            if(phase==Simulation::GuestPhase::Dining || (claim && claim->occupied && (phase==Simulation::GuestPhase::Queue || phase==Simulation::GuestPhase::Counter)))guest->reset(goal);
            else route(*guest,goal);
        }
        if(guest->follower.status()==FollowStatus::Blocked) {state.leave(g->id);departed.push_back(g->id);}
        else if(guest->follower.status()==FollowStatus::Arrived) {
            if(phase==Simulation::GuestPhase::Leaving)departed.push_back(g->id);
            else if(phase==Simulation::GuestPhase::ToSeat && claim && point!=Simulation::Pool::waiting)state.seated(g->id,point,token);
            else if(claim && point!=Simulation::Pool::waiting)pool==&state.queue?state.queue.occupy(g->id,point,token):state.counter.occupy(g->id,point,token);
        }
    }
    for(auto id:departed)state.departed(id);

    for(auto& worker:workers_) {
    auto* staff=dynamic_cast<CafeWalker*>(findActor(worker.actor));
    if(staff && !staff->isActiveInHierarchy())staff=nullptr;
    auto work=state.tasks->current(worker.worker);
    if(staff)staff->working(work && work->state==sim::TaskState::Running);
    if(staff)staff->cleaning(work && (work->spec.key=="cafe:clean" || work->spec.key=="cafe:machine-clean" || work->spec.key=="cafe:machine-repair") && work->state==sim::TaskState::Running);
    if(!work) {
        if(worker.task && staff)staff->stop();worker.task={};worker.token=0;worker.travel.clear();
        // Return from table service and other work to the staff side of the desk.
        // Keep one route alive until arrival, with a separate waiting spot per worker.
        if(staff && !worker.manualPosition) {
            const Vec3 home{staffHome.x-float(&worker-workers_.data())*.65f,0,staffHome.z};
            if(!worker.returningHome) {route(*staff,home);worker.returningHome=true;}
            if(staff->follower.status()==FollowStatus::Arrived)staff->face({home.x,0,counterPoint.z});
        }
    } else {
        worker.returningHome=false;
        worker.manualPosition=false;
        Vec3 target=staffHome;
        auto accessPoint=[&](int id){auto p=state.layout.find(id);if(!p)throw std::runtime_error("Equipment placement missing");auto c=sim::GridLayout::access(*p);return Vec3{-6.f+(float(c.x)+.5f)*.5f,0,-5.f+(float(c.z)+.5f)*.5f};};
        bool preparing=Simulation::preparationTask(work->spec.key);
        if(preparing || work->id==state.maintenanceTask)target=work->spec.key=="cafe:assist"?accessPoint(10):machinePoint;
        auto currentJob=preparing?state.productionJob(worker.worker):sim::JobId{};
        if(currentJob) {
            auto job=state.runtime->job(currentJob).value;
            if(job.process==definitions::processes[1].id || job.process==definitions::processes[3].id)target={-.35f,0,-3.4f};
            if(job.process==definitions::processes[2].id)target={-2.65f,0,-3.4f};
            if(job.process==definitions::processes[4].id || job.process==definitions::processes[10].id)target={2.5f,0,-3.4f};
            if(state.extraStation && job.station==state.extraStation)target=accessPoint(10);
            if(state.coldStation && job.station==state.coldStation)target=accessPoint(30);
        }
        else if(work->spec.key.starts_with("cafe:restock-")){int n=work->spec.key.back()-'0';target=state.restockAnnex[std::size_t(n)]?accessPoint(11):Vec3{4.5f,0,-3.4f};}
        else if(work->spec.key=="cafe:handover")target={1.2f,0,-3.4f};
        else if(work->spec.key=="cafe:take-order" || work->spec.key=="cafe:deliver") {
            auto* owner=state.visitingGuest(work->id);auto claim=owner?state.seats.claim(owner->id):std::nullopt;
            if(!claim || claim->point==Simulation::Pool::waiting)throw std::runtime_error("Table visit lost its seat");
            target=seatPoint(state,claim->point);
        }
        else if(work->spec.key=="cafe:clean") {
            auto* owner=state.cleaningGuest(work->id);auto claim=owner?state.seats.claim(owner->id):std::nullopt;
            if(!claim)throw std::runtime_error("Cleaning task lost its seat");
            if(worker.task!=work->id || worker.token!=work->token || worker.job!=currentJob) {
                Vec3 from=staffHome;if(staff){auto m=staff->worldMatrix();from={m.m[12],0,m.m[14]};}
                target=cleaningPoint(state,claim->point,from);
            }
        }
        if(worker.task!=work->id || worker.token!=work->token || worker.job!=currentJob) {
            if(staff)staff->stop();worker.travel.clear();worker.task=work->id;worker.token=work->token;worker.job=currentJob;
            bool runningJob=currentJob && state.runtime->job(currentJob).value.state==sim::JobState::Running;
            if(staff && work->state==sim::TaskState::Running && (!currentJob || runningJob))staff->reset(target);
            else if(staff) {
                route(*staff,target);
            }
        }
        auto* machine=findActor(machine_);
        auto status=staff && machine && machine->isActiveInHierarchy()?staff->follower.status():FollowStatus::Blocked;
        if(staff && work->spec.key=="cafe:clean" && status==FollowStatus::Arrived) {
            auto* owner=state.cleaningGuest(work->id);auto claim=state.seats.claim(owner->id);
            auto p=state.layout.find(claim->point+1);auto r=sim::GridLayout::footprint(*p);
            staff->face({-6.f+(float(r.x)+float(r.width)*.5f)*.5f,0,-5.f+(float(r.z)+float(r.depth)*.5f)*.5f});
        }
        if(status==FollowStatus::Blocked || (status==FollowStatus::Cancelled && work->state==sim::TaskState::Assigned)) {
            if(work->id==state.maintenanceTask)state.cancelMaintenance();else if(work->spec.key=="cafe:clean" || work->spec.key=="cafe:take-order" || work->spec.key=="cafe:deliver" || work->spec.key.starts_with("cafe:restock-"))Simulation::require(state.tasks->cancel(work->id));else state.cancel();
        } else if(status==FollowStatus::Arrived && (work->state==sim::TaskState::Assigned || (currentJob && work->state==sim::TaskState::Running))) {
            bool canStart=true;
            if(work->spec.key=="cafe:clean")canStart=state.cleaningGuest(work->id)->hasDeparted;
            if(canStart && preparing && currentJob) {
                auto job=state.runtime->job(currentJob);Simulation::require(job);
                if(job.value.state==sim::JobState::Assigned) {
                    Simulation::require(worker.travel.begin(*state.runtime,job.value.id));
                    auto result=worker.travel.complete(*state.runtime,*worker.travel.pending(),true);
                    if(!result && result.error!=sim::Error::LimitReached)Simulation::require(result);
                    canStart=bool(result);
                } else canStart=job.value.state==sim::JobState::Running || job.value.state==sim::JobState::Completed;
            }
            if(canStart && work->state==sim::TaskState::Assigned) {Simulation::require(state.tasks->start(work->id,worker.worker,work->token));}
        }
    }
    }
    state.refresh();
}
}
