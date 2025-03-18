JSON=$(wildcard *.json)
SVGS=$(JSON:.json=.svg)
SKIN=../../skin/default.svg

all: $(SVGS)

%.svg: %.json $(SKIN)
	node ../../bin/netlistsvg.js --skin $(SKIN) $< -o $@

clean:
	rm -f *.svg

.PHONY: all clean
