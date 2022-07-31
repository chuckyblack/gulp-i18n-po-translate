# gulp-i18n-po-translate

![example workflow](https://github.com/chuckyblack/gulp-i18n-po-translate/actions/workflows/test.yml/badge.svg)

Compiles html templates using po translation file.

```js
const gulp = require('gulp');
const translate = require('gulp-i18n-po-translate');

gulp.task("translate", function() {
	return gulp.src("**/*.html")
		.pipe(translate({
			pofile: 'locales/en/LC_MESSAGES/messages.po',
			attributes: ["placeholder", "alt", "title"]
		}))
		.pipe(gulp.dest("dist"))
	}
);
```
