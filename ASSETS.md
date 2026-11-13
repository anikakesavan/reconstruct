# Assets and licences

## Amazon Berkeley Objects (ABO) · CC BY 4.0 · https://amazon-berkeley-objects.s3.amazonaws.com/index.html
60 furniture and decor models in `apps/web/public/models` whose file names start with `B0`: beds, nightstands, desks, chairs,
armchairs, sofas, ottomans, dressers, wardrobes, bookcases, floor and table lamps, mirrors, pillows, planters and rugs.

Attribution (required by the licence): *Collins et al., "ABO: Dataset and Benchmarks for Real-World 3D Object Understanding",
CVPR 2022. 3D models © Amazon.com, licensed under CC BY 4.0.*

Changes made: converted to compressed GLB (meshopt, 1k WebP textures), simplified to at most about 26k triangles, given generic
names, and their colour textures are recoloured at run time when a user picks a different material colour. The models depict
real retail products; this project is not affiliated with or endorsed by Amazon or the product brands.

## Poly Haven · CC0 · https://polyhaven.com
Models: `modern_arm_chair_01`, `coffee_table_round_01`, `wooden_display_shelves_01`, `modern_wooden_cabinet`, `wicker_basket_02`,
`potted_plant_01`, `potted_plant_02`, `potted_plant_04`, `desk_lamp_arm_01`, `ceramic_vase_01`, `ceramic_vase_03`, `book_encyclopedia_set_01`.
Floor materials (`public/textures`): `wood_floor`, `laminate_floor_02`, `herringbone_parquet`. Lighting environment: `photo_studio_loft_hall`.

## Made for this project
Room shell (walls, floor, windows, doors, skirting), catalogue thumbnails (rendered from the models by `tools/render_thumbs.py`),
and the per-model part masks (`*.mask.png`, from `tools/build_catalog.py`).

## Models downloaded at setup, not stored here
- Depth Anything 3 Base and Metric-Large (Apache 2.0): depth and camera poses.
- OneFormer Swin-Tiny trained on ADE20K (code MIT; see the model card for the weights and the ADE20K dataset terms): finds furniture, windows and doors.

## Not shipped
Test photos used in development came from another project's example folder and are not in this repository.

## Font
Bricolage Grotesque, SIL Open Font License, via Fontsource.
