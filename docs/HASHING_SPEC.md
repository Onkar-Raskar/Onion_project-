# Onion Grader - Cryptographic Hashing Specification

To ensure that the generated PDF quality certificate is tamper-evident, a SHA-256 hash is computed and printed on the certificate. This hash cryptographically links the batch identifier to the final grading percentages, creating an auditable trail.

## Original Scan Hash

**Algorithm:** SHA-256
**Encoding:** UTF-8 String

The input string is constructed using a pipe-delimited (`|`) format containing the Batch ID and the exact percentage values (as strings, to 1 decimal place).

**Format:**
`{batchId}|A:{grade_a_pct}|C:{grade_c_pct}|URS:{urs_pct}`

**Example Input String:**
`ONION-LOT-169823904|A:75.5|C:10.2|URS:14.3`

**Example Output Hash (Hex):**
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

## Reassessment / Dispute Hash

If a batch is disputed and reassessed, a new certificate is generated containing both the original metrics and the reassessment metrics, plus a reason note.

**Format:**
`{batchId}|A:{new_grade_a_pct}|C:{new_grade_c_pct}|URS:{new_urs_pct}|Notes:{disputeNotes}`

**Example Input String:**
`ONION-LOT-169823904|A:78.0|C:8.0|URS:14.0|Notes:Farmer requested bottom-layer scan`

## Verification

To verify a printed certificate, an auditor can recreate the pipe-delimited string using the printed values and compute its SHA-256 hash. If the computed hash matches the hash printed on the document, the data has not been tampered with since generation.

*Note on Media: In future iterations, the raw byte array of the annotated image could be appended to the hash payload to verify the image itself was not altered.*
