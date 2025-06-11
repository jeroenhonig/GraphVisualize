// Debug script to test TTL parsing
import fs from 'fs';

// Read and test the TTL file
const content = fs.readFileSync('attached_assets/infrastructure_rdf_model_1749632869881.ttl', 'utf8');
console.log('File size:', content.length, 'bytes');
console.log('First 500 characters:');
console.log(content.substring(0, 500));

// Test prefix extraction
const prefixRegex = /@prefix\s+([^:]*):?\s*<([^>]+)>\s*\./g;
let match;
let prefixCount = 0;
while ((match = prefixRegex.exec(content)) !== null) {
  const prefix = match[1].trim();
  const uri = match[2];
  console.log(`Prefix ${++prefixCount}: ${prefix} -> ${uri}`);
}

// Test statement splitting
const rdfContent = content
  .replace(/@prefix[^.]*\./g, '')
  .replace(/#[^\r\n]*/g, '')
  .trim();

console.log('\nRDF content length after cleanup:', rdfContent.length);
console.log('Sample cleaned content:');
console.log(rdfContent.substring(0, 300));

// Split statements
const statements = rdfContent.split('.').filter(s => s.trim());
console.log('\nFound', statements.length, 'potential statements');

// Show first few statements
for (let i = 0; i < Math.min(3, statements.length); i++) {
  console.log(`\nStatement ${i + 1}:`, statements[i].trim().substring(0, 200));
}