const through = require('through2');
const fs = require('fs');
const pofile = require('pofile');
const cheerio = require('cheerio');
const htmlEntities = require('html-entities');

class Translator {
	constructor(path, translatedAttributes, throwOnMissingTranslation) {
		this.path = path;
		this.translatedAttributes = translatedAttributes;
		this.throwOnMissingTranslation = throwOnMissingTranslation;
		this.msgStrById = {};
		if (path) {
			this.loadPoFile(path);
		}
	}

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
		const $ = cheerio.load(content, {
			decodeEntities: false,
			_useHtmlParser2: true
		});
		$("*").each((index, element) => {
			element = $(element);
			if (!this.path) {
				// no translation file, remove marking attribut only
				const attrs = element[0].attribs;
				for (let attr in attrs) {
					if (attr.startsWith("i18n")) {
						element.removeAttr(attr);
					}
				}
				return;
			}
			if (this.hasAttr(element, "i18n")) {
				this.translateElement(file, element);
			}

			// automated translated attributes
			this.translatedAttributes.forEach(attrName => {
				const noI18nAttr = "no-i18n-" + attrName;
				const noTranslate = this.hasAttr(element, noI18nAttr);

				if (this.hasAttr(element, attrName) && !noTranslate) {
					this.translateAttr(file, element, attrName);
				}

				if (noTranslate) {
					element.removeAttr(noI18nAttr);
				}
			});

			// translated attributes marked with i18n-{{ attrname }}
			const attrs = element[0].attribs;
			for (let attr in attrs) {
				const value = attrs[attr];
				if (attr.startsWith("i18n-")) {
					const attrName = attr.replace("i18n-", "");
					if (this.hasAttr(element, attrName) && !this.translatedAttributes.includes(attrName)) {
						this.translateAttr(file, element, attrName);
					}
					element.removeAttr(attr);
				}
			}
		});

		return $.html();
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
		return htmlEntities.decode(text)
			.replace(/\n/g, " ")
			.replace(/\t/g, " ")
			.replace(/ /g, "&nbsp;")  // non-breakable space
			.replace(/[ ]+/g, ' ')
			.replace(/\/>/g, ">")
			.trim();
	}

	hasAttr(element, attrName) {
		const attr = element.attr(attrName);
		return typeof attr !== typeof undefined && attr !== false;
	}

	translateElement(file, element) {
		const html = element.html();
		const elementText = this.normalizeHtml(html);
		if (elementText === "") {
			// valid state - element has no content, eg. <input>
			return;
		}
		let translatedText = this.getTranslatedText(file, elementText);
		element.html(translatedText);
		element.removeAttr("i18n");

	}

	translateAttr(file, element, attrName) {
		const attrText = element.attr(attrName);
		const normalized = htmlEntities.decode(attrText).replace(/\n/g, "<br>");
		let translatedText = this.getTranslatedText(file, normalized);
		translatedText = translatedText.replace(/<br>/g, "&#xa;");
		translatedText = translatedText.replace(/"/g, "&quot;");
		translatedText = translatedText.replace(/</g, "&lt;");
		translatedText = translatedText.replace(/>/g, "&gt;");
		element.attr(attrName, translatedText);
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
