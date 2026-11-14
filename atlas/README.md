# Morphospaces Atlas

[**Open the Atlas**](https://cs-training-systems.github.io/morphogen/atlas/)

Part of Morphogen, versioned with it. Working name, tentative.

A classification system for computational visual generators: anything a computer can use to produce a 1-D or 2-D visual output, optionally changing over time. It is the classification layer underneath Morphogen.

## What it is

The Atlas is a **faceted classification**, not a taxonomy. A taxonomy is a single tree. Here, each record gets an **address** made of four choices:

```
law  ×  substrate  ×  mechanism family  ×  subtype
```

Example: Conway's Game of Life is `Δ-L · Cellular automata and fixed-site maps`. The first part is the route: the law's sign, a hyphen and the carrier's letter.

Each record is a *generator*, and each generator has its own space of parameters: its morphospace. The Atlas is the index of those spaces, which is where the name comes from.

## Unit of classification

The unit is a **specified mathematical generator or specified mathematical object**, not an informal model name. A record names the actual law or constructor, plus enough assumptions to pin down what is being classified.

Required distinctions:

- **Law vs. solver.** A numerical integrator is not the differential equation. A rendering algorithm is not the set or process it draws.
- **Model vs. output.** A dynamical law and a particular pattern it produces are separate records, linked rather than merged.
- **State vs. representation.** A continuum PDE discretised on a grid is still a continuum-field model, unless the lattice rule itself defines the model.
- **Probability.** A deterministic rule with a random starting state stays deterministic. It counts as stochastic only when the probability law is part of the record.

## Facet 1: Law architecture

Each class is written with its sign. The first three are the deterministic classes.

| Sign | Name | Short definition | Meaning |
|---|---|---|---|
| `0` | Atemporal | deterministic: fixed, static | A static object, solution, configuration or set; no time or construction index |
| `Δ` | Discrete time | deterministic: fixed rule applied incrementally | A fixed rule maps one indexed state or construction stage to the next |
| `∂` | Continuous time | deterministic: fixed rule applied continuously | A deterministic law evolves the state over continuous time (may include events, switching, resets) |
| `σ` | Stochastic | probabilistic: chance-based; random | A probability distribution is part of the specified generator |
| `∈` | Nondeterministic | possibilistic: several open-branching next states, with no probabilities attached | Several successors are allowed, with no probabilities attached (scope extension) |

## Facet 2: Substrate (the native state carrier)

Substrates classify what the state *is*, not what it looks like on screen.

| Code | Name | Meaning |
|---|---|---|
| `P` | Abstract point-state space | A point in an abstract state space; not a spatial point cloud |
| `F` | Continuum field | One or more fields over a continuous spatial domain |
| `L` | Lattice / fixed graph | Values on fixed discrete sites or fixed-connectivity nodes (cellular automata, spin systems, lattice gases) |
| `E` | Entity | Individually represented particles, agents, cells or bodies |
| `R` | Relational | Relations, edges or higher-order incidence are the primary state variables |
| `S` | Symbolic / combinatorial | Strings, trees, grammars and other symbolic objects |
| `G` | Geometric / set-valued | A spatial set, curve, surface, interface, tiling or shape |
| `X` | Composite | Two or more different kinds of state carrier, explicitly coupled (for example agents plus a field) |

Five law classes × eight substrates give 40 possible top-level routes.

## Facets 3 and 4: Mechanism family and subtype

The **family** is the formalism that implements the law on that substrate, for example "Cellular automata and fixed-site maps". The **subtype** is a navigation grouping beneath the family, not an extra mathematical axis.

## How strict is "MECE"?

MECE means mutually exclusive and collectively exhaustive: every record fits exactly one category and none is left out. Here it applies at the **record-address level**: one law × one substrate × one family path per specified record. The axes are not claimed to be mathematically independent. A named model with several valid formulations gets one precisely scoped record per formulation.

No finite list of families can prove complete coverage. The Atlas is a large curated map with an intake path for new mechanisms, not a proof of exhaustiveness.

## Relation to Morphogen

Morphogen's interface groups generators into easy-to-browse **types** (for example "1-D cellular automata"). When a user selects a generator, its Atlas address appears alongside it. The types are a presentation layer; the Atlas address is the classification.

## Status

- Canonical data: `data/atlas.json`, the v0.1.6 edition's database. The earlier internal labels (v1.3, v1.7, v0.1.5, v0.1.6) are provenance only.
- The page: `index.html`, `atlas.css` and `atlas.js`. It holds no copy of the data and reads `data/atlas.json` each time it loads.
- Record ids: a record's id is its four-digit number, such as `0154`. The id it had before, such as `DΔ-L-0154`, is kept in the record as `former_id` and still resolves on the page.
- Pictures: the files in `assets/archetypes/` are named by record number. They are also stored in the data file as opacity masks, a transparent ground with the drawing as opacity, so the page draws them in the ink color of its theme.
- Versioning: with Morphogen; see CONTRIBUTING.md, Versioning.
