import {Attributes, CrossCodeMap, MapLayer, Point} from '../../../models/cross-code-map';
import {CCMapLayer} from './cc-map-layer';
import {Globals} from '../../globals';
import {EntityManager} from '../entities/entity-manager';
import {Subscription} from 'rxjs';

export class CCMap {
	name = '';
	levels: { height: number }[] = [];
	mapWidth = 0;
	mapHeight = 0;
	masterLevel = 0;
	layers: CCMapLayer[] = [];
	attributes: Attributes = <any>{};
	screen: Point = {x: 0, y: 0};
	
	private tileMap?: Phaser.Tilemaps.Tilemap;
	
	private historySub: Subscription;
	private offsetSub: Subscription;
	
	filename = '';
	
	private inputLayers?: MapLayer[];
	
	constructor(
		private game: Phaser.Game,
		private scene: Phaser.Scene,
		private entityManager: EntityManager
	) {
		const stateHistory = Globals.stateHistoryService;
		this.historySub = stateHistory.selectedState.subscribe(container => {
			if (!container || !container.state) {
				return;
			}
			const selectedLayer = Globals.mapLoaderService.selectedLayer;
			const i = this.layers.indexOf(<any>selectedLayer.getValue());
			this.loadMap(JSON.parse(container.state.json), true);
			if (i >= 0 && this.layers.length > i) {
				selectedLayer.next(this.layers[i]);
			}
		});
		
		// TODO: move out of tilemap
		// const undoKey = game.input.keyboard.addKey(Phaser.Keyboard.Z);
		// game.input.keyboard.removeKeyCapture(undoKey.keyCode);
		// this.keyBinding = undoKey.onDown.add(() => {
		// 	if (Helper.isInputFocused()) {
		// 		return;
		// 	}
		// 	if (game.input.keyboard.isDown(Phaser.KeyCode.CONTROL)) {
		// 		if (game.input.keyboard.isDown(Phaser.KeyCode.SHIFT)) {
		// 			stateHistory.redo();
		// 		} else {
		// 			stateHistory.undo();
		// 		}
		// 	}
		//
		// });
		this.offsetSub = Globals.globalEventsService.offsetMap.subscribe(offset => this.offsetMap(offset));
	}
	
	destroy() {
		this.historySub.unsubscribe();
		this.offsetSub.unsubscribe();
	}
	
	async loadMap(map: CrossCodeMap, skipInit = false) {
		const tileMap = this.scene.make.tilemap({
			width: map.mapWidth,
			height: map.mapHeight,
			tileHeight: Globals.TILE_SIZE,
			tileWidth: Globals.TILE_SIZE
		});
		
		this.tileMap = tileMap;
		
		this.name = map.name;
		this.levels = map.levels;
		this.mapWidth = map.mapWidth;
		this.mapHeight = map.mapHeight;
		this.masterLevel = map.masterLevel;
		this.attributes = map.attributes;
		this.screen = map.screen;
		this.filename = map.filename;
		
		this.inputLayers = map.layer;
		
		// cleanup everything before loading new map
		this.layers.forEach(layer => layer.destroy());
		
		this.layers = [];
		
		// generate Map Layers
		if (this.inputLayers) {
			this.inputLayers.forEach(layer => {
				const ccLayer = new CCMapLayer(this.scene, tileMap, layer);
				this.layers.push(ccLayer);
			});
			
			this.inputLayers = undefined;
		}
		
		// generate entities
		await this.entityManager.initialize(map);
		
		if (!skipInit) {
			Globals.stateHistoryService.init({
				name: 'load',
				icon: 'insert_drive_file',
				json: JSON.stringify(this.exportMap())
			});
		}
		
		Globals.mapLoaderService.tileMap.next(this);
		Globals.mapLoaderService.selectedLayer.next(this.layers[0]);
	}
	
	resize(width: number, height: number, skipRender = false) {
		this.mapWidth = width;
		this.mapHeight = height;
		
		this.layers.forEach(layer => layer.resize(width, height, skipRender));
		Globals.phaserEventsService.updateMapBorder.next(true);
	}
	
	offsetMap(offset: Point, borderTiles = false) {
		this.layers.forEach(layer => layer.offsetLayer(offset, borderTiles));
	}
	
	addLayer(layer: CCMapLayer) {
		this.layers.push(layer);
	}
	
	removeLayer(layer: CCMapLayer) {
		const index = this.layers.indexOf(layer);
		this.layers.splice(index, 1);
		layer.destroy();
	}
	
	public getTilemap() {
		return this.tileMap;
	}
	
	exportMap(): CrossCodeMap {
		const out: CrossCodeMap = <any>{};
		
		out.name = this.name;
		out.levels = this.levels;
		out.mapWidth = this.mapWidth;
		out.mapHeight = this.mapHeight;
		out.masterLevel = this.masterLevel;
		out.attributes = this.attributes;
		out.screen = this.screen;
		console.log('exportMap');
		out.entities = this.entityManager.exportEntities();
		out.layer = [];
		this.layers.forEach(l => out.layer.push(l.exportLayer()));
		
		return out;
	}
}
