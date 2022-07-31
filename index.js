const through = require('through2');
const fs = require('fs');
const pofile = require('pofile');
const htmlParser = require('node-html-parser');
const htmlEntities = require('html-entities');

class Translator {
	/**
	 * @param path {string}
	 * @param translatedAttributes {string[]}
	 * @param throwOnMissingTranslation {boolean}
	 */
	constructor(path, translatedAttributes, throwOnMissingTranslation) {
		this.path = path;
		this.translatedAttributes = translatedAttributes;
		this.throwOnMissingTranslation = throwOnMissingTranslation;
		this.msgStrById = {};
		if (path) {
			this.loadPoFile(path);
		}
	}

	/**
	 * @param path {string}
	 */
	loadPoFile(path) {
		const data = fs.readFileSync(path, 'utf-8');
		const po = pofile.parse(data);
		po.items.forEach(item => {
			if (item.msgstr[0] === "") {
				return;
			}
			// TODO: map file path too
			this.msgStrById[item.msgid] = item.msgstr[0];
		});
	}

	/**
	 * @param file {string}
	 */
	translate(file) {
		const ext = file.relative.split('.').pop();
		switch (ext) {
			case "html":
				return this.translateHtml(file);
			case "js":
				return this.translateJs(file);
		}
		// unknown file type, do nothing
		return file.contents.toString();
	}

	translateHtml(file) {
		const content = file.contents.toString();
		const root = htmlParser.parse(content);
		root.querySelectorAll('*').forEach((element, index) => {
			if (!this.path) {
				// no translation file, remove marking attribut only
				element.removeAttribute("")
				for (const attribute in element.attributes) {
					if (attribute.startsWith("i18n")) {
						element.removeAttribute(attribute);
					}

				}
				return;
			}
			if (element.hasAttribute("i18n")) {
				this.translateElement(file, element);
			}

			// automated translated attributes
			this.translatedAttributes.forEach(attrName => {
				const noI18nAttr = "no-i18n-" + attrName;
				const noTranslate = element.hasAttribute(noI18nAttr);

				if (element.hasAttribute(attrName) && !noTranslate) {
					this.translateAttribute(file, element, attrName);
				}

				if (noTranslate) {
					element.removeAttribute(noI18nAttr);
				}
			});

			// translated attributes marked with i18n-{{ attrname }}
			for (const attribute in element.attributes) {
				if (attribute.startsWith("i18n-")) {
					const value = element.getAttribute(attribute);
					const attrName = attribute.replace("i18n-", "");
					if (element.hasAttribute(attrName) && !this.translatedAttributes.includes(attrName)) {
						this.translateAttribute(file, element, attrName);
					}
					element.removeAttribute(attribute);
				}
			}
		});

		return root.toString();
	}

	translateJs(file) {
		let content = file.contents.toString();
		["'", '"', "`"].forEach((char) => {
			content = content.replace(new RegExp("_\\(\\s*" + char + "([^" + char + "\\\\]*(?:\\\\.[^" + char + "\\\\]*)*)" + char + "\\s*\\)", "g"), (match, text) => {
				if (this.path) {
					text = this.getTranslatedText(file, text)
				}
				return char + text + char;
			});
		});
		return content;
	}

	getTranslatedText(file, original) {
		const translatedText = this.msgStrById[original];
		if (this.throwOnMissingTranslation && !translatedText) {
			throw this.getErrorMessage("Missing translation", file, original, translatedText);
		}
		if (!translatedText) {
			return original;
		}
		return translatedText;
	}

	getErrorMessage(message, file, originalText, translatedText) {
		return (
			message +
			" in " + this.path + "!\n" +
			"translated file " + file.path + "\n" +
			"originalText = '" + originalText + "'\n" +
			"translatedText = '" + translatedText + "'"
		);
	}

	normalizeHtml(text) {
		return text
			.replace(/\n/g, " ")
			.replace(/\t/g, " ")
			.replace(/[ ]+/g, ' ')
			.replace(/\/>/g, ">")
			.trim();
	}

	/**
	 * @param file
	 * @param element {HTMLElement}
	 */
	translateElement(file, element) {
		const html = element.innerHTML;
		const normalizedHtml = this.normalizeHtml(html);
		const elementText = this.normalizeHtmlEntities(normalizedHtml);

		if (elementText === "") {
			// valid state - element has no content, eg. <input>
			return;
		}
		element.innerHTML = this.getTranslatedText(file, elementText);
		element.removeAttribute("i18n");
	}

	/**
	 * @param file
	 * @param element {HTMLElement}
	 * @param attrName {string}
	 */
	translateAttribute(file, element, attrName) {
		const attrText = element.getAttribute(attrName);
		const normalizedText = this.normalizeHtmlEntities(attrText);
		const translatedText = (
			this.getTranslatedText(file, normalizedText)
				.replace(/<br>/g, "&#xa;")
				.replace(/"/g, "&quot;")
		);
		element.setAttribute(attrName, translatedText);
	}

	/**
	 * @param text {string}
	 */
	normalizeHtmlEntities(text) {
		return htmlEntities.decode(text)
			.replace(/\n/g, "<br>")
			.replace(/ /g, "&nbsp;");
	}
}

function getDefault(value, defaultValue) {
	return value !== undefined ? value : defaultValue;
}

module.exports = function(options) {
	const translator = new Translator(
		options.pofile,
		options.translatedAttributes || [],
		getDefault(options.throwOnMissingTranslation, true)
	);

	return through.obj(function(file, enc, callback) {
		const translated = translator.translate(file);
		file.contents = Buffer.from(translated);
		this.push(file);
		callback();
	}, function(callback) {
		callback();
	});
};

module.exports.Translator = Translator;
