YOSYS    ?= yosys
INKSCAPE ?= inkscape
VIEWER   ?= eog

YOSYS_FLAGS ?= -q
# YOSYS_FLAGS ?= -Q -T

# Node JS is sometimes installed as node and sometimes as nodejs
ifneq ($(shell which node),)
NODE     ?= node
else
ifneq ($(shell which nodejs),)
NODE     ?= nodejs
else
$(error "Can not find node(js), please set $$NODE to the node binary")
endif
endif

NETLISTSVG = ../bin/netlistsvg
NETLISTSVG_SKIN ?= ../skin/default.svg
NETLISTSVG_DPI  ?= 300

# Simple files are the same flattened as not
SIMPLE_FILES=dff.v muxcy.v xorcy.v
# Complex files are different when flattened
COMPLEX_FILES=carry4bits.v carry4whole.v

ALL_TARGETS= \
         $(foreach v,$(SIMPLE_FILES) ,$(basename $(v)).simple.all) \
         $(foreach v,$(COMPLEX_FILES),$(basename $(v)).complex.all)

GET_TOP ?= export TOP=$$(echo $(basename $<) | tr a-z A-Z);

# Top level diagram
%.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP; write_json $@" $<

# Split wires
%.split.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP; splitnets; write_json $@" $<

# Flatten
%.flat.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP -flatten; write_json $@" $<

# AIG
%.aig.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP -flatten; cd $$TOP; aigmap; write_json $@" $<

# NAND/AND/NOT
%.naig.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP -flatten; cd $$TOP; aigmap -nand; write_json $@" $<

# Simple logic
%.simplemap.json: %.v Makefile
	$(GET_TOP) $(YOSYS) $(YOSYS_FLAGS) -p "prep -top $$TOP -flatten; cd $$TOP; simplemap; write_json $@" $<

# SVG
%.svg: %.json $(NETLISTSVG_SKIN)
	$(NODE) $(NETLISTSVG) $< -o $@ --skin $(NETLISTSVG_SKIN)

# PNG
%.png: %.svg
	-$(INKSCAPE) --export-filename=$@ --export-dpi=$(NETLISTSVG_DPI) $< 2>&1 | grep -v "WARNING: unknown type: s:alias"

# View
%.view: %.png
	$(VIEWER) $< &

# Simple all
%.simple.all: %.png %.aig.png
	@true

# Complex all
%.complex.all: %.png %.split.png %.flat.png %.aig.png %.simplemap.png
	@true

# Build all
build.all: $(ALL_TARGETS)
	@true

# View all
view.all: $(ALL_TARGETS)
	$(VIEWER) *.png &

clean:
	rm -f *.json *.svg *.png

all: build.all

.DEFAULT_GOAL := all
.PRECIOUS: %.png
.PHONY: view clean all build.all view.all