// d3 chega como script classico vendorizado, antes do modulo. Nao entra no
// grafo de dependencias de proposito: manter o vendor fora do empacotador
// preserva o cache longo dele e a possibilidade de auditar o arquivo servido.
declare const d3: any;
