import fs from 'fs';
let data = fs.readFileSync('js/data.js', 'utf8');
const waterSpriteMap = {
  'Tubarão': "img/sprites/Novos 8bits/units/shark.png",
  'Sapo': "img/sprites/Novos 8bits/units/frog.png",
  'Hipocampo': "img/sprites/Novos 8bits/units/hipocampo.png",
  'Baleia': "img/sprites/Novos 8bits/units/whale.png",
};
const snowSpriteMap = {
  'Yeti Atirador': "img/sprites/Novos 8bits/boss/yeti.png",
  'Pinguim': "img/sprites/Novos 8bits/units/penguin.png",
};
function applySpriteReplacements(spriteMap) {
  let count = 0;
  for (const [name, newSprite] of Object.entries(spriteMap)) {
    const regex = new RegExp(
      `name: '${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'.*?sprite: '[^']*'`,
      's'
    );
    const match = data.match(regex);
    if (match) {
      const replaced = match[0].replace(/sprite: '[^']*'/, `sprite: '${newSprite}'`);
      data = data.replace(match[0], replaced);
      count++;
      console.log(`✓ ${name} → ${newSprite}`);
    } else {
      console.log(`✗ ${name} - não encontrado`);
    }
  }
  return count;
}
let total = 0;
total += applySpriteReplacements(waterSpriteMap);
total += applySpriteReplacements(snowSpriteMap);
fs.writeFileSync('js/data.js', data);
console.log(`\nWATER+SNOW atualizados: ${total}`);