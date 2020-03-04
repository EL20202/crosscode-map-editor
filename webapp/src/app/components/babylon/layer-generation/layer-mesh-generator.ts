import {Globals} from '../../../shared/globals';
import {CCMapLayer} from '../../../shared/phaser/tilemap/cc-map-layer';
import {RadialSweepTracer} from './boundary-tracing/radial-sweep-tracer';
import {Mesh, MeshBuilder, Scene, Vector3, Vector4} from '@babylonjs/core';
import * as earcut from 'earcut';
import {SideMeshGenerator} from './side-mesh-generator';
import {getLevelOffsetTile} from './offset-helper';
import {SimpleTileLayer} from './simple-tile-layer';
import Tile = Phaser.Tilemaps.Tile;

export class LayerMeshGenerator {
	
	public generateLevel(collLayer: CCMapLayer, scene: Scene) {
		const map = Globals.map;
		if (!map) {
			throw new Error('map doesnt exist');
		}
		
		const phaserLayer = collLayer.getPhaserLayer();
		if (!phaserLayer) {
			throw new Error('phaser layer of collision layer does not exist');
		}
		
		const simpleTileLayer = new SimpleTileLayer();
		simpleTileLayer.initWithoutDiagonals(phaserLayer);
		
		const tiles: Tile[] = simpleTileLayer.tiles.flat();
		
		if (collLayer.details.level < Globals.map.masterLevel) {
			console.log('< master level');
			tiles.forEach(tile => {
				// if (tile.index === 1) {
				// 	tile.index = 8;
				// }
				// tile.index = 4;
			});
		}
		
		const allTiles = new Set<Tile>();
		for (const tile of tiles) {
			if (tile.index <= 0) {
				continue;
			}
			
			allTiles.add(tile);
		}
		
		if (allTiles.size === 0) {
			console.warn('not generating mesh, collision layer is empty');
			return [];
		}
		
		const meshes: Mesh[] = [];
		
		let meshCounter = 0;
		
		while (allTiles.size > 0) {
			const toCheck: (Tile | null)[] = [allTiles.values().next().value];
			const group = new Set<Tile>();
			while (toCheck.length > 0) {
				const tile = toCheck.pop()!;
				if (allTiles.delete(tile)) {
					
					group.add(tile);
					toCheck.push(...this.getNeighbours(tile, simpleTileLayer));
				}
			}
			meshes.push(this.generateMesh('coll layer ' + collLayer.details.level + ' - ' + (++meshCounter), group, collLayer, simpleTileLayer, scene));
			// debug mesh
			// const ground = MeshBuilder.CreateGround('debug plane', {
			// 	width: collLayer.details.width,
			// 	height: collLayer.details.height
			// });
			// ground.position.y = 1;
			// meshes.push(ground);
		}
		
		return meshes;
	}
	
	private generateMesh(name: string, tiles: Set<Tile>, ccLayer: CCMapLayer, simpleTileLayer: SimpleTileLayer, scene: Scene) {
		const layer = ccLayer.getPhaserLayer()!;
		const tracer = new RadialSweepTracer();
		const path = Array.from(tracer.getContour(tiles, simpleTileLayer));
		
		let maxX = -9999;
		let minX = 9999;
		
		let maxY = -9999;
		let minY = 9999;
		for (const v of path) {
			minX = Math.min(minX, v.x);
			maxX = Math.max(maxX, v.x);
			
			minY = Math.min(minY, v.y);
			maxY = Math.max(maxY, v.y);
		}
		
		// minY = 0;
		const topWidth = (maxX - minX) / layer.tilemap.width;
		const topHeight = (maxY - minY) / layer.tilemap.height;
		
		const offsetX = minX / layer.tilemap.width;
		const level = ccLayer.details.level;
		const heightOffset = getLevelOffsetTile(level + 1) - getLevelOffsetTile(level);
		console.log(`level: ${level} - offset: ${heightOffset}`);
		let offsetY = (layer.tilemap.height - maxY + heightOffset) / layer.tilemap.height;
		
		// 1 px offset, no idea where that comes from
		offsetY -= 1 / layer.tilemap.heightInPixels;
		
		const pathArr = Array.from(path).map(t => {
			return new Vector3(t.x, 0, -t.y);
		});
		
		const top = MeshBuilder.CreatePolygon(name, {
			shape: pathArr,
			updatable: true,
			faceUV: [
				new Vector4(offsetX, offsetY, offsetX + topWidth, offsetY + topHeight),
				new Vector4(0, 0, 0, 0),
				new Vector4(0, 0, 0, 0)
			]
		}, scene, earcut);
		
		const sideMeshGenerator = new SideMeshGenerator();
		const mesh = sideMeshGenerator.generate(top, ccLayer, simpleTileLayer);
		
		const merge = Mesh.MergeMeshes([top, mesh])!;
		
		merge.position.x = -layer.tilemap.width * 0.5;
		merge.position.z = layer.tilemap.height * 0.5;
		
		let levelOffset = getLevelOffsetTile(ccLayer.details.level);
		merge.position.y = levelOffset;
		if (levelOffset < 0) {
			levelOffset = 0;
		}
		merge.position.z -= levelOffset;
		
		return merge;
		// return top;
	}
	
	private getNeighbours(tile: Tile, layer: SimpleTileLayer) {
		const out: (Tile | null)[] = [
			layer.getTileAt(tile.x + 1, tile.y),
			layer.getTileAt(tile.x - 1, tile.y),
			layer.getTileAt(tile.x, tile.y + 1),
			layer.getTileAt(tile.x, tile.y - 1),
		];
		
		return out.filter(tile => tile);
	}
}
