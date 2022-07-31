import {Translator} from "./index";
const Vinyl = require('vinyl');

function createVinyl(content, wrap=true) {
	if (wrap) {
		content = wrapHtml(content);
	}
	return new Vinyl({
		cwd: '/',
		base: '/',
		path: '/test.html',
		contents: Buffer.from(content)
	});
}

function wrapHtml(content) {
	return '<html><head></head><body>' + content + '</body></html>'
}

const translator = new Translator(
	"./test.po",
	["placeholder", "data-title", "alt", "data-tooltip", "title"],
	true
);


test('normalizeText', () => {
	const t = new Translator(null, [], true, true);
	const result = t.normalizeHtml("hello\n\t    world<br/>");
	expect(result).toBe("hello world<br>");
});

test('normalizeHtml', () => {
	const html = '<span ' +
		'\t\t\tclass="asdf"\n' +
		'\t\tid="asdf"\n' +
		'\t  >\n\t   \ttest\n' +
		'</span>\n\n';
	const result = translator.translateHtml(createVinyl(html, false));
	expect(result).toBe('<span class="asdf" id="asdf" > test </span>');
});


test('simpleString', () => {
	const result = translator.translateHtml(createVinyl('<div i18n>ahoj světe!</div>'));
	expect(result).toBe(wrapHtml('<div>hello world!</div>'));
});


test('preserveOriginal', () => {
	const translator = new Translator(null, ["placeholder", "data-title", "alt", "data-tooltip", "title"], ["p", "h1", "h2", "h3", "h4", "li"], true, true);
	const result = translator.translateHtml(createVinyl('<div i18n>ahoj světe!</div><div>ahoj světe!</div><div some-attribute="nějaký titulek" i18n-some-attribute i18n>ahoj světe!</div>'));
	expect(result).toBe(wrapHtml('<div>ahoj světe!</div><div>ahoj světe!</div><div some-attribute="nějaký titulek">ahoj světe!</div>'));
});


test('comments', () => {
	const result = translator.translateHtml(createVinyl('<div i18n="komentář pro překladatele">ahoj světe!</div>'));
	expect(result).toBe(wrapHtml('<div>hello world!</div>'));
});


test('nestedTags', () => {
	const result = translator.translateHtml(createVinyl('<div i18n>ahoj <strong>krásný</strong> světe!</div>'));
	expect(result).toBe(wrapHtml('<div>hello <strong>beautiful</strong> world!</div>'));
});


test('utf8Encoding', () => {
	const result = translator.translateHtml(createVinyl('<div i18n>Příliš žluťoučký kůň úpěl ďábelské ódy.</div>'));
	expect(result).toBe(wrapHtml('<div>Really hard to translate sentence.</div>'));
});

test('attribute', () => {
	const result = translator.translateHtml(createVinyl('<div some-attribute="nějaký titulek" i18n-some-attribute i18n>ahoj světe!</div>'));
	expect(result).toBe(wrapHtml('<div some-attribute="some title">hello world!</div>'));
});

test('attributeWithNewline', () => {
	const result = translator.translateHtml(createVinyl('<div title="nějaký&#xa;titulek" i18n>ahoj světe!</div>'));
	expect(result).toBe(wrapHtml('<div title="some&#xa;title">hello world!</div>'));
});

test('autoTranslateDataAttribute', () => {
	const result = translator.translateHtml(createVinyl('<div data-tooltip="nějaký titulek" i18n>ahoj světe!</div>'));
	expect(result).toBe(wrapHtml('<div data-tooltip="some title">hello world!</div>'));
});

test('doNotTranslateAttribute', () => {
	const result = translator.translateHtml(createVinyl('<div title="nějaký titulek" no-i18n-title i18n>ahoj světe!</div>'));
	expect(result).toBe(wrapHtml('<div title="nějaký titulek">hello world!</div>'));
});

test('htmlWithNbsp', () => {
	const result = translator.translateHtml(createVinyl('<div i18n>ahoj&nbsp;světe!</div>'));
	expect(result).toBe(wrapHtml('<div>hello&nbsp;world!</div>'));
});

test('jsStringWithNbsp', () => {
	const result = translator.translateJs(createVinyl("_('Objednávka č. {{ vm.order.id }}')", false));
	expect(result).toBe("'Order #{{ vm.order.id }}'");
});

test('htmlWithQuote', () => {
	const result = translator.translateHtml(createVinyl('<div i18n>ahoj "uvozovky"</div>'));
	expect(result).toBe(wrapHtml('<div>hello "quotes"</div>'));
});

test('htmlWithQuoteEntity', () => {
	const result = translator.translateHtml(createVinyl('<div i18n>ahoj &quot;uvozovky&quot;</div>'));
	expect(result).toBe(wrapHtml('<div>hello "quotes"</div>'));
});

test('attributeWithQuote', () => {
	const result = translator.translateHtml(createVinyl('<div title=\'ahoj "uvozovky"\'>test</div>'));
	expect(result).toBe(wrapHtml('<div title="hello &quot;quotes&quot;">test</div>'));
});

test('attributeWithQuoteEntity', () => {
	const result = translator.translateHtml(createVinyl('<div title="ahoj &quot;uvozovky&quot;">test</div>'));
	expect(result).toBe(wrapHtml('<div title="hello &quot;quotes&quot;">test</div>'));
});

test('attributeWithLt', () => {
	const result = translator.translateHtml(createVinyl('<div title="jedna < dvě">test</div>'));
	expect(result).toBe(wrapHtml('<div title="one &lt; two">test</div>'));
});

test('attributeWithLtEntity', () => {
	const result = translator.translateHtml(createVinyl('<div title="jedna &lt; dvě">test</div>'));
	expect(result).toBe(wrapHtml('<div title="one &lt; two">test</div>'));
});

test('htmlWithLt', () => {
	const result = translator.translateHtml(createVinyl('<div i18n>jedna < dvě</div>'));
	expect(result).toBe(wrapHtml('<div>one &lt; two</div>'));
});

test('htmlWithLtEntity', () => {
	const result = translator.translateHtml(createVinyl('<div i18n>jedna &lt; dvě</div>'));
	expect(result).toBe(wrapHtml('<div>one &lt; two</div>'));
});
