// Test script to debug TTL parsing
const fs = require('fs');

// Read a small sample from the TTL file
const content = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix infra: <https://example.org/infrastructure/> .

infra:InfrastructureObject 
    rdf:type owl:Class ;
    rdfs:label "Infrastructuur Object"@nl ;
    rdfs:comment "Basis klasse voor alle infrastructurale objecten"@nl .

obj:OBJ-00144 
    rdf:type infra:Road ;
    prop:objectCode "OBJ-00144" ;
    prop:objectName "Gebiedsontsluitingsweg Helhoek" .`;

console.log('Testing TTL content:');
console.log(content);
console.log('\n--- Starting Parse ---');

// Extract prefixes
const prefixes = new Map();
const prefixRegex = /@prefix\s+([^:]*):?\s*<([^>]+)>\s*\./g;
let match;
while ((match = prefixRegex.exec(content)) !== null) {
  const prefix = match[1].trim();
  const uri = match[2];
  prefixes.set(prefix, uri);
  console.log(`Found prefix: ${prefix} -> ${uri}`);
}

// Remove prefixes and split into blocks
const contentWithoutPrefixes = content
  .replace(/@prefix[^.]*\./g, '')
  .split('\n')
  .filter(line => !line.trim().startsWith('#') && line.trim())
  .join('\n');

console.log('\nContent without prefixes:');
console.log(contentWithoutPrefixes);

const statementBlocks = contentWithoutPrefixes
  .split(/\s*\.\s*/)
  .filter(block => block.trim());

console.log('\nStatement blocks found:');
statementBlocks.forEach((block, i) => {
  console.log(`Block ${i}:`, block.trim());
});