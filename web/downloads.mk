
WEB_DOWNLOADS := $(TMP_WEB_PATH)/_koheron.css
WEB_DOWNLOADS += $(TMP_WEB_PATH)/jquery.flot.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/jquery.flot.resize.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/jquery.flot.selection.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/jquery.flot.time.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/jquery.flot.axislabels.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/jquery.flot.canvas.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/bootstrap.min.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/bootstrap.min.css
WEB_DOWNLOADS += $(TMP_WEB_PATH)/jquery.min.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/_koheron_logo.svg
WEB_DOWNLOADS += $(TMP_WEB_PATH)/_koheron.png
WEB_DOWNLOADS += $(TMP_WEB_PATH)/kbird.ico
WEB_DOWNLOADS += $(TMP_WEB_PATH)/lato-v11-latin-400.woff2
WEB_DOWNLOADS += $(TMP_WEB_PATH)/lato-v11-latin-700.woff2
WEB_DOWNLOADS += $(TMP_WEB_PATH)/lato-v11-latin-900.woff2
WEB_DOWNLOADS += $(TMP_WEB_PATH)/glyphicons-halflings-regular.woff2
WEB_DOWNLOADS += $(TMP_WEB_PATH)/html-imports.min.js
WEB_DOWNLOADS += $(TMP_WEB_PATH)/html-imports.min.js.map
WEB_DOWNLOADS += $(TMP_WEB_PATH)/navigation.html

FLOT_VERSION = 0.8.3
#FLOT_VERSION = 4.2.6

$(TMP_WEB_PATH)/_koheron.css: download/_koheron.css
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/jquery.flot.js: download//jquery.flot.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/jquery.flot.resize.js: download/jquery.flot.resize.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/jquery.flot.selection.js: download/jquery.flot.selection.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/jquery.flot.time.js: download/jquery.flot.time.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/jquery.flot.axislabels.js: download/jquery.flot.axislabels.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/jquery.flot.canvas.js: download/jquery.flot.canvas.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/bootstrap.min.js: download/bootstrap.min.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/bootstrap.min.css: download/bootstrap.min.css
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/jquery.min.js: download/jquery.min.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/_koheron.png: download/_koheron.png
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/_koheron_logo.svg: download/_koheron_logo.svg
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/kbird.ico: download/kbird.ico
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/lato-v11-latin-400.woff2: download/lato-v11-latin-400.woff2
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/lato-v11-latin-700.woff2: download/lato-v11-latin-700.woff2
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/lato-v11-latin-900.woff2: download/lato-v11-latin-900.woff2
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/glyphicons-halflings-regular.woff2: download/glyphicons-halflings-regular.woff2
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/html-imports.min.js: download//html-imports.min.js
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/html-imports.min.js.map: download/html-imports.min.js.map
	mkdir -p $(@D)
	cp $< $@

$(TMP_WEB_PATH)/navigation.html: $(WEB_PATH)/navigation.html
	mkdir -p $(@D)
	cp $< $@
