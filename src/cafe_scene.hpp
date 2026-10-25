#pragma once
#include "engine/scene.hpp"
#include "engine/camera_component.hpp"
#include "engine/mesh_component.hpp"
#include "simulation.hpp"

namespace cafe {
class CafeScene final : public engine::Scene {
public:
    CafeScene();
    engine::CameraComponent& camera() { return *camera_; }
    void project(const Simulation& state);
private:
    engine::CameraComponent* camera_ = nullptr;
    engine::MeshComponent* cup_ = nullptr;
    engine::MeshComponent& box(const char* name, engine::Vec3 position, engine::Vec3 scale, engine::Vec3 color);
};
}
