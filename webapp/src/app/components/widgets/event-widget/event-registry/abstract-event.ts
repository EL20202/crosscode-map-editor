import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { EntityAttributes, WMType } from '../../../../services/phaser/entities/cc-entity';
import { Label, VarExpression, VarValue } from '../../../../models/events';
import { Point, Point3 } from '../../../../models/cross-code-map';

export interface EventType {
	type: string;
}

export interface EventTypeChild {
	title?: string;
	draggable?: boolean;
	events: AbstractEvent<any>[];
}

export abstract class AbstractEvent<T extends EventType> {
	
	public info = '---';
	public children: EventTypeChild[] = [];
	
	constructor(
		private domSanitizer: DomSanitizer,
		public data: T,
		public actionStep = false,
	) {
	}
	
	protected abstract generateNewDataInternal(): { [key: string]: any };
	
	public generateNewData() {
		const data = this.generateNewDataInternal();
		data['type'] = this.data.type;
		this.data = <any>data;
	}
	
	public abstract getAttributes(): EntityAttributes | undefined;
	
	public abstract update(): void;
	
	public export(): T {
		return JSON.parse(JSON.stringify(this.data));
	}
	
	protected combineStrings(...values: string[]): string {
		return values.join(' ');
	}
	
	protected getAllPropStrings(): string {
		const keys = Object.keys(this.data);
		return keys
			.filter(key => key !== 'type')
			.map(key => this.getPropString(key))
			.join(' ');
	}
	
	protected getPropString(key: string, value?: any): string {
		if (value === undefined) {
			value = this.data[key as keyof T];
		}
		const attr = this.getAttributes();
		if (attr && attr[key]) {
			const type = attr[key].type;
			switch (type as WMType) {
				case 'Color': 
					value = this.getColorRectangle(value);
					break;
				case 'Vec2':
				case 'Vec2Expression':
					value = this.getVarExpressionValue(value, true);
					if(typeof value !== 'string') {
						const vec2 = value as Point;
						value = this.getVec2String(vec2.x, vec2.y);
					}
					break;
				case 'Vec3':
				case 'Vec3Expression':
					value = this.getVarExpressionValue(value, true);
					if(typeof value !== 'string') {
						const vec3 = value as Point3 & {lvl: number};
						value = this.getVec3String(vec3.x, vec3.y, vec3.z, vec3.lvl);
					}
					break;
				case 'Offset':
					if(value) {
						value = this.getVec3String(value.x, value.y, value.z);
					}
					break;
				case 'Entity':
					if(value.player){
						value = 'player';
					} else if(value.self) {
						value = 'self';
					} else if(value.name) {
						value = '[' + value.name + ']';
					} else if (value.varName) {
						value = `[Var: ${value.varName}]`;
					} else if (value.party) {
						value = `[Party: ${value.party}]`; 
					}
					break;
				case 'EnemyType':
					value = '[' + value.type + ']';
					break;
				case 'NumberExpression':
				case 'StringExpression':
				case 'BooleanExpression':
					value = this.getVarExpressionValue(value);
					break;
				case 'VarName':
					if(value.indirect) {
						value = `[indirect: ${value.indirect}]`;
					} else if (value.actorAttrib) {
						value = `[actorAttrib: ${value.indirect}]`;
					}
					break;
				case 'Effect':
				case 'Animation':
					if(value) {
						value = `${value.sheet}/${value.name}`;
					}
					break;
			}
		}
		
		//Wrapping the key-value pair in a display-block span makes it so that long events get first split across different properties,
		//while the individual property's text only gets split when it's too long to fit in a single line
		return `<span style="display: inline-block;"><span style="color: #858585">${key}</span>: ${value}</span>`;
	}
	
	protected getVarExpressionValue(value: VarExpression, supportsActorAttrib = false): VarValue {
		if(typeof value == 'object') {
			if('indirect' in value) {
				value = `[indirect: ${value.indirect}]`;
			} else if('varName' in value) {
				value = `[varName: ${value.varName}]`;
			} else if('actorAttrib' in value && supportsActorAttrib) {
				value = `[actorAttrib: ${value.actorAttrib}]`;
			}
		}
		return value as VarValue;
	}

	protected getVec2String(x: number, y: number): string {
		return `(${this.sanitize(x)}, ${this.sanitize(y)})`;
	}

	protected getVec3String(x: number, y: number, z?: number, level?: number): string {
		if(level !== undefined) {
			return `(${this.sanitize(x)}, ${this.sanitize(y)}, lvl ${this.sanitize(level)})`;
		} else {
			return `(${this.sanitize(x)}, ${this.sanitize(y)}, ${this.sanitize(z!)})`;
		}
	}
	
	protected getTypeString(color: string): string {
		color = this.sanitize(color);
		return this.getBoldString(this.data.type, color);
	}
	
	protected getBoldString(text: string, color: string): string {
		return `<b style="color: ${this.sanitize(color)}">${text}</b>`;
	}
	
	protected getColoredString(text: string, color: string): string {
		return `<span style="color: ${this.sanitize(color)}">${text}</span>`;
	}
	
	protected getColorRectangle(color: string): string {
		return `<span style="background-color: ${this.sanitize(color)};">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>`;
	}

	protected getProcessedText(langLabel: Label): string {
		const textColors = [
			null,	   // \c[0] White
			'#ff6969', // \c[1] Red
			'#65ff89', // \c[2] Green
			'#ffe430', // \c[3] Yellow
			'#808080', // \c[4] Gray
			//'#ff8932',  \c[5] Orange, only used for small font in vanilla
		];
		let text = langLabel?.en_US ?? '';

		let inSpan = false;
		text = text.replace(/\\c\[(\d+)\]|$/g, (substr, colorIndex) => {
			const color = textColors[+colorIndex];
			let replacement = '';
			if(inSpan) {
				replacement += '</span>';
				inSpan = false;
			}
			if(color) {
				replacement += `<span style="color: ${color}">`;
				inSpan = true;
			} else if (color !== null) {
				//preserve the original color code untouched.
				replacement += substr;
			}
			return replacement;
		});

		return text;
	}
	
	private sanitize(val: string | number) {
		return this.domSanitizer.sanitize(SecurityContext.HTML, val) || '';
	}
}
