"""
Headless Blender asset-assembly script for Aiden's VEST (skin) pipeline.

Invoked as:
    blender --background --python assemble_skin.py -- --workdir <dir>

Reads <workdir>/mesh.glb (Tripo's already-textured, rigged mesh output
- text-to-3D was called with texture: true, see tripo-provider.ts) and
three Kandinsky-generated PBR maps from the same directory
(normal.png, specular.png, emission.png - see pbr-maps.ts), wires them
into the mesh's Principled BSDF material, and exports <workdir>/output.glb.

Client, 2026-08-18 (KOBA Aiden pipeline spec): Tripo already supplies
the mesh geometry, the rig, and the baked diffuse texture (the "Mesh
Engine", "Skeletal & Weights Engine", and implicitly the diffuse via
Tripo's own texture:true option). This script is the "PBR Materials
Engine" assembly step - it generates no new pixels, it only wires the
three provided maps into the mesh's existing material graph and
re-exports one finished, installable asset.

Blender socket names changed across versions (4.x renamed "Specular"
to "Specular IOR Level" and "Emission"/"Emission Strength" to
"Emission Color"/"Emission Strength" as two separate sockets) - this
looks up both names defensively rather than assuming one Blender
version, since the target VPS's exact installed version isn't pinned
yet.

NOT unit-testable outside a real Blender install - bpy only exists
inside Blender's own bundled Python interpreter, so this file can't be
imported or run by this repo's normal test suite. Verified instead by
argument construction (buildBlenderArgs) and the fail-closed
configuration gate (isBlenderConfigured) in
features/aiden/lib/blender-assembly.ts. This script's actual 3D output
has NOT been smoke-tested end to end - that needs a real run once
Blender is installed on the target host.
"""

import argparse
import os
import sys

import bpy  # type: ignore  # only resolvable inside Blender's own interpreter


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    parser = argparse.ArgumentParser()
    parser.add_argument("--workdir", required=True)
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)


def find_or_create_material(obj):
    if obj.data.materials and obj.data.materials[0] is not None:
        return obj.data.materials[0]
    material = bpy.data.materials.new(name="AidenSkinMaterial")
    material.use_nodes = True
    obj.data.materials.append(material)
    return material


def load_image_texture(path, colorspace):
    image = bpy.data.images.load(path)
    image.colorspace_settings.name = colorspace
    return image


def wire_pbr_maps(material, workdir):
    if not material.use_nodes:
        material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise RuntimeError(
            "Mesh material has no Principled BSDF node to wire PBR maps into."
        )

    # Normal map: goes through a dedicated Normal Map node - BSDF.Normal
    # expects a vector, not a raw color, so a texture can never be
    # plugged straight into it.
    normal_tex = nodes.new("ShaderNodeTexImage")
    normal_tex.image = load_image_texture(
        os.path.join(workdir, "normal.png"), "Non-Color"
    )
    normal_map_node = nodes.new("ShaderNodeNormalMap")
    links.new(normal_tex.outputs["Color"], normal_map_node.inputs["Color"])
    links.new(normal_map_node.outputs["Normal"], bsdf.inputs["Normal"])

    # Specular/roughness map: grayscale, feeds the specular input
    # directly. Socket renamed "Specular IOR Level" in Blender 4.x.
    specular_tex = nodes.new("ShaderNodeTexImage")
    specular_tex.image = load_image_texture(
        os.path.join(workdir, "specular.png"), "Non-Color"
    )
    specular_input = bsdf.inputs.get("Specular IOR Level") or bsdf.inputs.get(
        "Specular"
    )
    if specular_input is not None:
        links.new(specular_tex.outputs["Color"], specular_input)

    # Emission map: real color data (glowing regions keep their
    # generated hue), feeds Emission Color; strength bumped up from its
    # zero default so it's actually visible.
    emission_tex = nodes.new("ShaderNodeTexImage")
    emission_tex.image = load_image_texture(
        os.path.join(workdir, "emission.png"), "sRGB"
    )
    emission_color_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get(
        "Emission"
    )
    if emission_color_input is not None:
        links.new(emission_tex.outputs["Color"], emission_color_input)
    strength_input = bsdf.inputs.get("Emission Strength")
    if strength_input is not None:
        strength_input.default_value = 1.0


def main():
    args = parse_args()
    workdir = args.workdir
    mesh_path = os.path.join(workdir, "mesh.glb")
    output_path = os.path.join(workdir, "output.glb")

    if not os.path.isfile(mesh_path):
        raise RuntimeError(f"Expected mesh at {mesh_path}, not found.")

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=mesh_path)

    mesh_objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("Imported glTF contained no mesh objects.")

    for obj in mesh_objects:
        material = find_or_create_material(obj)
        wire_pbr_maps(material, workdir)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_apply=True,
    )

    if not os.path.isfile(output_path):
        raise RuntimeError("Blender export reported success but produced no file.")


if __name__ == "__main__":
    main()
