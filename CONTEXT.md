# Vehicle knowledge

SpecSync describes vehicle configurations through attributes, source-supported
assertions and explicit decisions about which assertions are accepted.

## Language

**Vehicle configuration**:
A particular variant of a vehicle model, scoped by market and model year when
the source establishes those details. Similar names do not establish identity.

**Attribute definition**:
The meaning, value type and canonical unit of one comparable vehicle property.
Payload and towing capacity are different attributes even when both use kilograms.

**Attribute alias**:
A linguistic term for an attribute. Similar wording alone does not establish
functional equivalence between manufacturer features.

**Specification assertion**:
A source-supported statement about an attribute of a vehicle configuration,
including its original value, relevant conditions and review status.

**Accepted specification**:
The current decision about an attribute for a configuration: known, not reported
or conflicting. A missing value does not mean that equipment is absent.

**Evidence**:
An identifiable source passage supporting an assertion. Evidence derived from a
document reader must remain distinguishable from the original document.

**Feature package**:
A manufacturer-defined grouping of features whose applicability and availability
depend on the source and configuration. A package is not an alias for one feature.
