import {Injectable} from '@angular/core';
import {Globals} from '../shared/globals';
import {Remote, Dialog} from 'electron';

@Injectable()
export class ElectronService {
	
	constructor() {
		if (!Globals.isElectron) {
			return;
		}
		
		// @ts-ignore
		this.remote = window.require('electron').remote;
		this.fs = this.remote.require('fs');
		this.path = this.remote.require('path');
		
		this.assetsPath = localStorage.getItem(this.storageName);
		this.updateURL();
	}
	
	public readonly path;
	public readonly fs;
	
	private storageName = 'assetsPath';
	private assetsPath: string;
	private readonly remote: Remote;
	
	private static normalizePath(p: string) {
		if (p.endsWith('\\')) {
			p = p.split('\\').join('/');
		}
		if (!p.endsWith('/')) {
			p += '/';
		}
		return p;
	}
	
	private updateURL() {
		Globals.URL = 'file:///' + this.assetsPath;
	}
	
	public relaunch() {
		this.remote.app.relaunch();
		this.remote.app.quit();
	}
	
	public checkAssetsPath(path: string): boolean {
		try {
			const files = this.fs.readdirSync(path);
			return files.includes('data') && files.includes('media');
		} catch (e) {
			console.error(e);
			return false;
		}
	}
	
	public selectCcFolder(): string {
		const dialog: Dialog = this.remote.dialog;
		const newPath = dialog.showOpenDialog({
			title: 'Select CrossCode assets folder',
			defaultPath: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\CrossCode\\assets',
			properties: ['openDirectory']
		});
		
		return newPath ? newPath[0] : undefined;
	}
	
	public saveAssetsPath(path: string) {
		const normalized = ElectronService.normalizePath(path);
		this.assetsPath = normalized;
		localStorage.setItem(this.storageName, normalized);
		this.updateURL();
	}
	
	public getAssetsPath() {
		return this.assetsPath;
	}
}
