/// <reference path="Tag.ts"/>

// Declare FastFuzzy global (provided by fast-fuzzy-standalone.js)
declare var FastFuzzy: any;

// namespace
namespace cf {
	// interface

	// class
	export class SelectTag extends Tag {

		private getWeightedScore(input: string, target: string, threshold: number): number {
			const inputLower = input.toLowerCase().trim();
			const targetLower = target.toLowerCase().trim();

			if (!inputLower || !targetLower) return 0;

			// Exact match - highest priority
			if (inputLower === targetLower) return 1.0;

			// Starts with (prefix match) - very high score
			if (targetLower.startsWith(inputLower)) return 0.95;

			// Ends with (suffix match) - high score
			if (targetLower.endsWith(inputLower)) return 0.90;

			// Fuzzy match using fast-fuzzy
			return FastFuzzy.fuzzy(inputLower, targetLower, { threshold });
		}

		public optionTags: Array<OptionTag>;
		private _values: Array<string>;

		public get type (): string{
			return "select";
		}

		public get name (): string{
			return this.domElement && this.domElement.hasAttribute("name") ? this.domElement.getAttribute("name") : this.optionTags[0].name;
		}

		public get value (): string | Array<string> {
			return this._values;
		}

		public get multipleChoice(): boolean{
			return this.domElement.hasAttribute("multiple");
		}

		constructor(options: ITagOptions){
			super(options);

			// build the option tags
			this.optionTags = [];
			var domOptionTags: NodeListOf<HTMLOptionElement> = this.domElement.getElementsByTagName("option");
			for (let i = 0; i < domOptionTags.length; i++) {
				let element: HTMLOptionElement = <HTMLOptionElement>domOptionTags[i];
				let tag: OptionTag = <OptionTag> cf.Tag.createTag(element);

				if(tag){
					this.optionTags.push(tag);
				}else{
					console.warn((<any>this.constructor).name, 'option tag invalid:', tag);
				}
			}
		}

		public setTagValueAndIsValid(dto: FlowDTO):boolean{
			let isValid: boolean = false;

			// select tag values are set via selected attribute on option tag
			let numberOptionButtonsVisible: Array <OptionButton> = [];
			this._values = [];

			if(dto.controlElements){
				// TODO: Refactor this so it is less dependant on controlElements
				for (let i = 0; i < this.optionTags.length; i++) {
					let tag: OptionTag = <OptionTag>this.optionTags[i];

					for (let j = 0; j < dto.controlElements.length; j++) {
						let controllerElement: OptionButton = <OptionButton>dto.controlElements[j];
						if(controllerElement.referenceTag == tag){
							// tag match found, so set value
							tag.selected = controllerElement.selected;

							// check for minimum one selected
							if(!isValid && tag.selected)
								isValid = true;

							if(tag.selected)
								this._values.push(<string> tag.value);

							if(controllerElement.visible)
								numberOptionButtonsVisible.push(controllerElement);
						}
					}
				}
			}else{
				// for when we don't have any control elements, use fuzzy matching to map values
				let bestMatch: ITag = null;
				let bestScore: number = 0;
				const threshold = 0.6;
				const userText = dto.text.toString();

				for (let i = 0; i < this.optionTags.length; i++) {
					let tag: ITag = <ITag>this.optionTags[i];
					const optionValue = tag.value.toString();
					const labelText = tag.label || '';

					// Check both value and label with weighted scoring
					const valueScore = this.getWeightedScore(userText, optionValue, threshold);
					const labelScore = this.getWeightedScore(userText, labelText, threshold);

					// Take the higher of the two scores
					const maxScore = Math.max(valueScore, labelScore);

					// Track the best match
					if(maxScore > bestScore){
						bestScore = maxScore;
						bestMatch = tag;
					}
				}

				// Select only the best match if it meets the threshold
				if(bestMatch && bestScore >= threshold){
					this._values.push(<string> bestMatch.value);
					(<HTMLInputElement> bestMatch.domElement).checked = true;
					isValid = true;
				}
			}

			// special case 1, only one optiontag visible from a filter
			if(!isValid && numberOptionButtonsVisible.length == 1){
				let element: OptionButton = numberOptionButtonsVisible[0];
				let tag: OptionTag = this.optionTags[this.optionTags.indexOf(<OptionTag> element.referenceTag)];
				element.selected = true;
				tag.selected = true;
				isValid = true;

				if(tag.selected)
					this._values.push(<string> tag.value);
			}

			return isValid;
		}
	}
}

