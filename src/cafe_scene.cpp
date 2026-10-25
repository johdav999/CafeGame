#include "cafe_scene.hpp"
#include "engine/light_component.hpp"

namespace cafe {
using namespace engine;
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
    ambient = {.3f, .27f, .23f};
    camera_ = &spawn("Cafe camera").addComponent<CameraComponent>();
    camera_->transform.position = {10, 9, 12};
    camera_->lookAt({0, 1, 0});
    box("Oak floor", {0, -.15f, 0}, {12, .3f, 10}, {.43f, .28f, .17f});
    box("Sage back wall", {0, 2, -5}, {12, 4, .2f}, {.4f, .52f, .4f});
    box("Cream side wall", {-6, 2, 0}, {.2f, 4, 10}, {.8f, .73f, .58f});
    box("Service counter", {0, .65f, -2}, {6, 1.3f, 1.2f}, {.25f, .34f, .26f});
    box("Countertop", {0, 1.35f, -2}, {6.2f, .15f, 1.4f}, {.85f, .76f, .6f});
    box("Espresso machine", {-1.6f, 1.8f, -2.2f}, {1.3f, .8f, .7f}, {.15f, .17f, .16f});
    box("Machine brass trim", {-1.6f, 1.7f, -1.82f}, {1.1f, .14f, .08f}, {.75f, .5f, .2f});
    cup_ = &box("Prepared coffee", {1.2f, 1.63f, -2}, {.22f, .35f, .22f}, {.93f, .87f, .72f});
    cup_->enabled = false;
    for (float x : {-3.f, 2.8f}) {
        box("Cafe table", {x, .95f, 1.4f}, {1.8f, .12f, 1.6f}, {.65f, .41f, .22f});
        box("Table pedestal", {x, .45f, 1.4f}, {.2f, .9f, .2f}, {.16f, .2f, .16f});
        for (float z : {.1f, 2.7f}) {
            box("Chair seat", {x, .5f, z}, {.85f, .15f, .8f}, {.55f, .25f, .13f});
            box("Chair base", {x, .22f, z}, {.55f, .45f, .55f}, {.22f, .25f, .18f});
        }
    }
    box("Plant pot", {-4.5f, .4f, -3.7f}, {.65f, .8f, .65f}, {.6f, .28f, .15f});
    auto& leaves = spawn("Plant foliage").addComponent<MeshComponent>("Leaves", Mesh::sphere(12, 8));
    leaves.transform.position = {-4.5f, 1.25f, -3.7f};
    leaves.transform.scale = {.7f, 1, .7f};
    leaves.color = {.22f, .43f, .18f};
    auto& sun = spawn("Morning sunlight").addComponent<LightComponent>("Sun", LightType::Directional);
    sun.direction = {-.4f, -1, -.2f};
    sun.color = {1, .87f, .67f};
    sun.intensity = 2;
}
void CafeScene::project(const Simulation& state) { cup_->enabled = state.ready; }
}
