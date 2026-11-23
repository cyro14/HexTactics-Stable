import fs from 'fs';
let data = fs.readFileSync('js/data.js', 'utf8');
const landSpriteMap = {
  'Pássaro': "img/sprites/Novos 8bits/units/crow.png",
  'Bem-te-vi': "img/sprites/Novos 8bits/units/bemtevi.png",
  'Corvo': "img/sprites/Novos 8bits/units/crow.png",
  'Tartaruga': "img/sprites/Novos 8bits/units/turtle.png",
  'Cavalo': "img/sprites/Novos 8bits/units/horse.png",
  'Pesadelo': "img/sprites/Novos 8bits/units/nightmare.png",
  'Unicórnio': "img/sprites/Novos 8bits/units/unicorn.png",
  'Morcego': "img/sprites/Novos 8bits/units/bat.png",
  'Cobra': "img/sprites/Novos 8bits/units/snake.png",
  'Escorpião': "img/sprites/Novos 8bits/units/scorpion.png",
  'Escorpião Ancião': "img/sprites/Novos 8bits/units/scorpion-2.png",
  'Macaco': "img/sprites/Novos 8bits/units/monkey.png",
  'Raposa': "img/sprites/Novos 8bits/units/fox.png",
  'Raposa de Fogo': "img/sprites/Novos 8bits/units/firefox-2.png",
  'Javali': "img/sprites/Novos 8bits/units/javali.png",
  'Urso': "img/sprites/Novos 8bits/units/bear.png",
  'Elefante': "img/sprites/Novos 8bits/units/elephant.png",
  'Leão Selvagem': "img/sprites/Novos 8bits/units/lion.png",
  'Tigre': "img/sprites/Novos 8bits/units/tiger.png",
  'Golem de Pedra': "img/sprites/Novos 8bits/boss/rock-golem.png",
  'Canguru': "img/sprites/Novos 8bits/units/canguru.png",
  'Cervo': "img/sprites/Novos 8bits/units/cervo.png",
  'Salamandra': "img/sprites/Novos 8bits/units/lizard-gola.png",
  'Cão Infernal': "img/sprites/Novos 8bits/units/hotweiler.png",
  'Filhote de Hotweiler': "img/sprites/Novos 8bits/baby/baby-hotweiler.png",
  'Hotweiler Ancião': "img/sprites/Novos 8bits/units/hotweiler-2.png",
  'Pássaro Trovão': "img/sprites/Novos 8bits/units/thunderbird.png",
  'Qilin': "img/sprites/Novos 8bits/units/qilin.png",
  'Aravata': "img/sprites/Novos 8bits/boss/aravata.png",
  'Saci-Pererê': "img/sprites/Novos 8bits/units/perere.png",
  'Jackalope': "img/sprites/Novos 8bits/units/jackalope.png",
  'Lagarto Escarlate': "img/sprites/Novos 8bits/units/lizard.png",
  'Lagarto de Gola': "img/sprites/Novos 8bits/units/lizard-gola.png",
  'Zumbi Ancião': "img/sprites/Novos 8bits/units/zombie.png",
  'Raposa de Quatro Caudas': "img/sprites/Novos 8bits/units/kitsune.png",
  'Coruja Umbral': "img/sprites/Novos 8bits/units/coruja-umbral.png",
  'Sauropode Ancião': "img/sprites/Novos 8bits/units/mosassauro.png",
  'Cerberus Sanguinário': "img/sprites/Novos 8bits/boss/cerberus.png",
  'Anjo Vingador': "img/sprites/Novos 8bits/leaders/angel.png",
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
total += applySpriteReplacements(landSpriteMap);
fs.writeFileSync('js/data.js', data);
console.log(`LAND atualizados: ${total}`);