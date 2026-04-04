require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// ========================================
// 🔐 VALIDAÇÃO DE ENV
// ========================================
const REQUIRED_ENVS = [
  'TOKEN',
  'CLIENT_ID',
  'STAFF_ROLE_ID',
  'WARN_1',
  'WARN_2',
  'WARN_3',
  'LOG_CHANNEL_ID'
];

for (const env of REQUIRED_ENVS) {
  if (!process.env[env]) {
    console.log(chalk.red(`[ERRO CRÍTICO] Variável faltando: ${env}`));
    process.exit(1);
  }
}

// ========================================
// 📁 BANCO DE DADOS (JSON)
// ========================================
const DB_PATH = path.join(__dirname, 'warns.json');

// cria se não existir
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
}

// carregar DB
function loadDB() {
  try {
    const raw = fs.readFileSync(DB_PATH);
    return JSON.parse(raw);
  } catch (err) {
    console.log(chalk.red('[ERRO] Falha ao carregar DB, recriando...'));
    return {};
  }
}

// salvar DB
function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.log(chalk.red('[ERRO] Falha ao salvar DB'));
  }
}

// garantir usuário no DB
function ensureUser(db, userId) {
  if (!db[userId]) {
    db[userId] = {
      warns: []
    };
  }
}

// ========================================
// 🎨 CORES DO SISTEMA
// ========================================
const COLORS = {
  SUCCESS: 0x2ECC71,
  WARN1: 0xF1C40F,
  WARN2: 0xE74C3C,
  WARN3: 0x2C2F33,
  ERROR: 0xE74C3C,
  INFO: 0x3498DB
};

// pegar cor por quantidade
function getWarnColor(count) {
  if (count === 1) return COLORS.WARN1;
  if (count === 2) return COLORS.WARN2;
  if (count >= 3) return COLORS.WARN3;
  return COLORS.SUCCESS;
}

// ========================================
// 🧾 LOGGER AVANÇADO
// ========================================
const logger = {
  info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green(`[SUCESSO] ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[AVISO] ${msg}`)),
  error: (msg) => console.log(chalk.red(`[ERRO] ${msg}`)),
  perm: (msg) => console.log(chalk.magentaBright(`[PERMISSÃO] ${msg}`))
};

// ========================================
// 🆔 GERADOR DE ID ÚNICO
// ========================================
function generateWarnID() {
  const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WRN-${p1}-${p2}`;
}

// ========================================
// 🤖 CLIENT DISCORD
// ========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ========================================
// 🔧 UTIL: FORMATAR WARNS
// ========================================
function formatWarnList(warns) {
  if (!warns.length) return 'Nenhum warn.';

  return warns.map((warn, index) => {
    let emoji = '🟡';

    if (index === 1) emoji = '🔴';
    if (index >= 2) emoji = '⚫';

    return `${emoji} #${index + 1} ${warn.id} - ${warn.reason}`;
  }).join('\n');
}

// ========================================
// 🔧 UTIL: EMBED PADRÃO
// ========================================
function createBaseEmbed() {
  return new EmbedBuilder()
    .setFooter({ text: 'Sistema de Moderação' })
    .setTimestamp();
}

// ========================================
// 🔧 UTIL: EMBED DE ERRO
// ========================================
function errorEmbed(message) {
  return createBaseEmbed()
    .setColor(COLORS.ERROR)
    .setTitle('❌ Erro')
    .setDescription(message);
}

// ========================================
// 🔧 UTIL: EMBED DE PERMISSÃO
// ========================================
function noPermEmbed() {
  return createBaseEmbed()
    .setColor(COLORS.ERROR)
    .setTitle('🚫 Sem Permissão')
    .setDescription('Você não possui permissão para usar este comando.');
}

// ========================================
// 🔧 UTIL: SEGURANÇA
// ========================================

// evitar warn negativo
function safeCount(n) {
  return n < 0 ? 0 : n;
}

// evitar self action
function isSelf(interaction, target) {
  return interaction.user.id === target.id;
}

// ========================================
// 🔧 UTIL: LOG NO DISCORD
// ========================================
async function sendLog(guild, embed) {
  try {
    const channel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (!channel) return;

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`Falha log: ${err.message}`);
  }
}
// ========================================
// 🌍 SLASH COMMANDS
// ========================================
const commands = [
  new SlashCommandBuilder()
    .setName('warnstats')
    .setDescription('Ver warns de um usuário')
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuário alvo')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('addwarn')
    .setDescription('Adicionar warn a um usuário')
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuário alvo')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo do warn')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('removewarn')
    .setDescription('Remover warn de um usuário')
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuário alvo')
        .setRequired(true)
    )
];

// ========================================
// 🌐 REGISTRO GLOBAL (SEM GUILD)
// ========================================
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    logger.info('Registrando comandos globais...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(cmd => cmd.toJSON()) }
    );

    logger.success('Comandos registrados com sucesso.');
  } catch (err) {
    logger.error(`Erro ao registrar comandos: ${err.message}`);
  }
}

// ========================================
// 🔐 PERMISSÃO STAFF (CORRIGIDA)
// ========================================
async function isStaff(interaction) {
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member.roles.cache.has(process.env.STAFF_ROLE_ID);
  } catch (err) {
    logger.perm('Falha ao verificar staff');
    return false;
  }
}

// ========================================
// 🛡️ PERMISSÕES DO BOT
// ========================================
function checkBotPermissions(guild) {
  const bot = guild.members.me;

  const required = [
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.ViewChannel
  ];

  const missing = required.filter(p => !bot.permissions.has(p));

  if (missing.length > 0) {
    logger.perm(`Permissões faltando: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

// ========================================
// 🎭 SISTEMA DE CARGOS (SEM BUG)
// ========================================
async function updateWarnRoles(member, warnCount) {
  try {
    // remove todos primeiro (regra: nunca acumular)
    const rolesToRemove = [
      process.env.WARN_1,
      process.env.WARN_2,
      process.env.WARN_3
    ];

    await member.roles.remove(rolesToRemove).catch(() => {});

    // aplicar correto
    if (warnCount === 1) {
      await member.roles.add(process.env.WARN_1);
    }

    if (warnCount === 2) {
      await member.roles.add(process.env.WARN_2);
    }

    if (warnCount >= 3 && process.env.WARN_3) {
      await member.roles.add(process.env.WARN_3);
    }

    // se 0 warns → não adiciona nada (limpo)
    if (warnCount === 0) {
      // já removeu tudo acima
    }

  } catch (err) {
    logger.error(`Erro cargos: ${err.message}`);
  }
}

// ========================================
// 🧹 LIMPEZA TOTAL DE CARGOS
// ========================================
async function clearWarnRoles(member) {
  try {
    await member.roles.remove([
      process.env.WARN_1,
      process.env.WARN_2,
      process.env.WARN_3
    ]);
  } catch (err) {
    logger.error('Erro ao limpar cargos');
  }
}

// ========================================
// 📩 DM SEGURA
// ========================================
async function safeDM(user, embed) {
  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch (err) {
    logger.warn(`Falha DM: ${user.tag}`);
    return false;
  }
}

// ========================================
// 👢 KICK SEGURO
// ========================================
async function safeKick(member, reason) {
  try {
    if (!member.kickable) {
      logger.error(`Não pode kickar: ${member.user.tag}`);
      return false;
    }

    await member.kick(reason);
    logger.success(`Kick aplicado: ${member.user.tag}`);
    return true;

  } catch (err) {
    logger.error(`Erro kick: ${err.message}`);
    return false;
  }
}

// ========================================
// 🔍 VALIDAÇÃO GERAL (ANTI BUG)
// ========================================
async function validateInteraction(interaction) {
  try {
    // verificar permissões do bot
    if (!checkBotPermissions(interaction.guild)) {
      await interaction.reply({
        embeds: [errorEmbed('O bot não possui permissões suficientes.')],
        ephemeral: true
      });
      return false;
    }

    const target = interaction.options.getUser('usuario');

    if (target) {
      // evitar bot
      if (target.bot) {
        await interaction.reply({
          embeds: [errorEmbed('Não é possível usar comandos em bots.')],
          ephemeral: true
        });
        return false;
      }

      // evitar self
      if (isSelf(interaction, target)) {
        await interaction.reply({
          embeds: [errorEmbed('Você não pode usar isso em si mesmo.')],
          ephemeral: true
        });
        return false;
      }
    }

    return true;

  } catch (err) {
    logger.error(`Erro validação: ${err.message}`);
    return false;
  }
}
// ========================================
// 🚀 READY EVENT
// ========================================
client.once('ready', async () => {
  logger.success(`Bot online como ${client.user.tag}`);
  await registerCommands();
});

// ========================================
// 🎯 INTERAÇÕES
// ========================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const db = loadDB();

  try {

    // validação geral
    const valid = await validateInteraction(interaction);
    if (!valid) return;

    // ========================================
    // 📊 /WARNSTATS
    // ========================================
    if (interaction.commandName === 'warnstats') {

      const target = interaction.options.getUser('usuario') || interaction.user;
      const userData = db[target.id] || { warns: [] };

      // sem warns
      if (!userData.warns.length) {
        const embed = createBaseEmbed()
          .setColor(COLORS.SUCCESS)
          .setTitle('✅ Usuário Limpo')
          .setDescription(`${target} não possui warns.`)
          .setThumbnail(target.displayAvatarURL({ dynamic: true }));

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      // com warns
      const embed = createBaseEmbed()
        .setColor(getWarnColor(userData.warns.length))
        .setTitle('📊 Estatísticas de Warn')
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Usuário', value: `${target}`, inline: true },
          { name: '⚠️ Warns Ativos', value: `${userData.warns.length}`, inline: true },
          { name: '📄 Últimos Warns', value: formatWarnList(userData.warns) }
        );

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // ========================================
    // ➕ /ADDWARN
    // ========================================
    if (interaction.commandName === 'addwarn') {

      if (!(await isStaff(interaction))) {
        logger.perm(`${interaction.user.tag} tentou usar /addwarn`);
        return interaction.reply({
          embeds: [noPermEmbed()],
          ephemeral: true
        });
      }

      const target = interaction.options.getUser('usuario');
      const reason = interaction.options.getString('motivo');

      const member = await interaction.guild.members.fetch(target.id);

      ensureUser(db, target.id);

      const warnID = generateWarnID();

      // adicionar warn
      db[target.id].warns.push({
        id: warnID,
        reason,
        date: new Date().toISOString()
      });

      let warnCount = db[target.id].warns.length;
      warnCount = safeCount(warnCount);

      saveDB(db);

      // atualizar cargos
      await updateWarnRoles(member, warnCount);

      // ========================================
      // 📩 PUNIÇÃO 2 WARNS
      // ========================================
      if (warnCount === 2) {
        await safeDM(target,
          createBaseEmbed()
            .setColor(COLORS.WARN2)
            .setTitle('⚠️ Aviso Importante')
            .setDescription('Você atingiu **2 warns**.')
            .addFields({ name: 'Motivo', value: reason })
        );
      }

      // ========================================
      // 👢 PUNIÇÃO 3 WARNS
      // ========================================
      if (warnCount >= 3) {
        await safeKick(member, '3 warns atingidos');
      }

      // ========================================
      // 📦 EMBED RESPOSTA
      // ========================================
      const embed = createBaseEmbed()
        .setColor(getWarnColor(warnCount))
        .setTitle('⚠️ Warn Aplicado')
        .addFields(
          { name: '👤 Usuário', value: `${target}` },
          { name: '📄 Motivo', value: reason },
          { name: '⚠️ Warns Ativos', value: `${warnCount}` },
          { name: '🆔 ID', value: warnID }
        );

      await interaction.reply({ embeds: [embed] });

      // ========================================
      // 📜 LOG
      // ========================================
      const logEmbed = createBaseEmbed()
        .setColor(getWarnColor(warnCount))
        .setTitle('📜 Log de Moderação')
        .addFields(
          { name: 'Usuário', value: `${target}` },
          { name: 'Staff', value: `${interaction.user}` },
          { name: 'Ação', value: 'Add Warn' },
          { name: 'Warns', value: `${warnCount}` },
          { name: 'ID', value: warnID }
        );

      await sendLog(interaction.guild, logEmbed);

      logger.success(`Warn aplicado em ${target.tag}`);
    }

    // ========================================
    // ➖ /REMOVEWARN
    // ========================================
    if (interaction.commandName === 'removewarn') {

      if (!(await isStaff(interaction))) {
        logger.perm(`${interaction.user.tag} tentou usar /removewarn`);
        return interaction.reply({
          embeds: [noPermEmbed()],
          ephemeral: true
        });
      }

      const target = interaction.options.getUser('usuario');

      if (!db[target.id] || db[target.id].warns.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('Este usuário não possui warns.')],
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(target.id);

      const removedWarn = db[target.id].warns.pop();

      let warnCount = db[target.id].warns.length;
      warnCount = safeCount(warnCount);

      saveDB(db);

      // atualizar cargos
      await updateWarnRoles(member, warnCount);

      // ========================================
      // 📦 EMBED RESPOSTA
      // ========================================
      const embed = createBaseEmbed()
        .setColor(getWarnColor(warnCount))
        .setTitle('✅ Warn Removido')
        .addFields(
          { name: '👤 Usuário', value: `${target}` },
          { name: '⚠️ Warns Restantes', value: `${warnCount}` },
          { name: '🆔 ID Removido', value: removedWarn.id }
        );

      await interaction.reply({ embeds: [embed] });

      // ========================================
      // 📜 LOG
      // ========================================
      const logEmbed = createBaseEmbed()
        .setColor(COLORS.SUCCESS)
        .setTitle('📜 Log de Moderação')
        .addFields(
          { name: 'Usuário', value: `${target}` },
          { name: 'Staff', value: `${interaction.user}` },
          { name: 'Ação', value: 'Remove Warn' },
          { name: 'Warns', value: `${warnCount}` },
          { name: 'ID', value: removedWarn.id }
        );

      await sendLog(interaction.guild, logEmbed);

      logger.success(`Warn removido de ${target.tag}`);
    }

  } catch (err) {
    logger.error(err.stack);

    try {
      await interaction.reply({
        embeds: [errorEmbed('Ocorreu um erro inesperado.')],
        ephemeral: true
      });
    } catch {}
  }
});
// ========================================
// 🔄 SINCRONIZAÇÃO (CARGOS → DB)
// ========================================
// Resolve o problema:
// "usuário tem cargo mas não aparece warn"

async function syncRolesToDatabase() {
  try {
    logger.info('Iniciando sincronização de cargos...');

    const db = loadDB();

    for (const guild of client.guilds.cache.values()) {
      const members = await guild.members.fetch();

      members.forEach(member => {
        let count = 0;

        if (member.roles.cache.has(process.env.WARN_1)) count = 1;
        if (member.roles.cache.has(process.env.WARN_2)) count = 2;
        if (member.roles.cache.has(process.env.WARN_3)) count = 3;

        if (count > 0) {
          db[member.id] = {
            warns: Array.from({ length: count }).map((_, i) => ({
              id: generateWarnID(),
              reason: 'Sincronizado automaticamente',
              date: new Date().toISOString()
            }))
          };
        }
      });
    }

    saveDB(db);

    logger.success('Sincronização concluída.');
  } catch (err) {
    logger.error(`Erro na sync: ${err.message}`);
  }
}

// ========================================
// 🧠 AUTO-SYNC AO INICIAR
// ========================================
client.once('ready', async () => {
  try {
    await syncRolesToDatabase();
  } catch (err) {
    logger.warn('Falha ao sincronizar na inicialização.');
  }
});

// ========================================
// ⚠️ TRATAMENTO GLOBAL DE ERROS
// ========================================
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
});

// ========================================
// 🔄 PROTEÇÃO DE DB CORROMPIDO
// ========================================
function safeLoadDB() {
  try {
    return loadDB();
  } catch {
    logger.warn('DB corrompido, resetando...');
    saveDB({});
    return {};
  }
}

// ========================================
// 📊 MONITORAMENTO SIMPLES
// ========================================
setInterval(() => {
  logger.info(`Servidores: ${client.guilds.cache.size}`);
}, 1000 * 60 * 5); // a cada 5 min

// ========================================
// 🚀 LOGIN
// ========================================
client.login(process.env.TOKEN)
  .then(() => logger.success('Login realizado com sucesso.'))
  .catch(err => logger.error(`Erro ao logar: ${err.message}`));

// ========================================
// 🏁 FINALIZAÇÃO
// ========================================
logger.info('Sistema de moderação iniciado com sucesso.');