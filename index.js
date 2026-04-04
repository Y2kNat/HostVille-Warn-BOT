// ===============================
// 📦 IMPORTS
// ===============================
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

// ===============================
// 🔐 ENV CHECK
// ===============================
const requiredEnvs = [
  'TOKEN',
  'CLIENT_ID',
  'STAFF_ROLE_ID',
  'WARN_1',
  'WARN_2',
  'WARN_3',
  'LOG_CHANNEL_ID'
];

for (const env of requiredEnvs) {
  if (!process.env[env]) {
    console.log(chalk.red(`[ERRO] Variável de ambiente faltando: ${env}`));
    process.exit(1);
  }
}

// ===============================
// 🧠 DATABASE (JSON)
// ===============================
const dbPath = path.join(__dirname, 'warns.json');

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({}));
}

function loadDB() {
  return JSON.parse(fs.readFileSync(dbPath));
}

function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ===============================
// 🎨 CORES
// ===============================
const COLORS = {
  SUCCESS: 0x2ECC71,
  WARNING1: 0xF1C40F,
  WARNING2: 0xE74C3C,
  WARNING3: 0x2C2F33,
  ERROR: 0xE74C3C
};

// ===============================
// 🧾 LOGGER
// ===============================
const logger = {
  info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green(`[SUCESSO] ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[AVISO] ${msg}`)),
  error: (msg) => console.log(chalk.red(`[ERRO] ${msg}`)),
  perm: (msg) => console.log(chalk.magentaBright(`[PERMISSÃO] ${msg}`))
};

// ===============================
// 🆔 GERADOR DE ID
// ===============================
function generateWarnID() {
  const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WRN-${part1}-${part2}`;
}

// ===============================
// 🤖 CLIENT
// ===============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ===============================
// ⚙️ SLASH COMMANDS
// ===============================
const commands = [
  new SlashCommandBuilder()
    .setName('warnstats')
    .setDescription('Ver warns de um usuário')
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuário')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('addwarn')
    .setDescription('Adicionar warn')
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
    .setDescription('Remover warn')
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuário alvo')
        .setRequired(true)
    )
];

// ===============================
// 🌍 REGISTRO GLOBAL
// ===============================
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    logger.info('Registrando comandos globais...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(cmd => cmd.toJSON()) }
    );

    logger.success('Comandos registrados globalmente.');
  } catch (err) {
    logger.error(`Erro ao registrar comandos: ${err.message}`);
  }
}

// ===============================
// 🛠️ UTIL: PERMISSÃO STAFF
// ===============================
function isStaff(member) {
  return member.roles.cache.has(process.env.STAFF_ROLE_ID);
}

// ===============================
// 🛠️ UTIL: CORES POR WARN
// ===============================
function getColorByWarns(count) {
  if (count === 1) return COLORS.WARNING1;
  if (count === 2) return COLORS.WARNING2;
  if (count >= 3) return COLORS.WARNING3;
  return COLORS.SUCCESS;
}

// ===============================
// 🛠️ UTIL: FORMATAR WARNS
// ===============================
function formatWarnList(warns) {
  if (!warns.length) return 'Nenhum warn.';

  return warns.map((w, i) => {
    let emoji = '🟡';
    if (i === 1) emoji = '🔴';
    if (i === 2) emoji = '⚫';

    return `${emoji} #${i + 1} ${w.id} - ${w.reason}`;
  }).join('\n');
}

// ===============================
// 🛠️ UTIL: GERENCIAR CARGOS
// ===============================
async function updateRoles(member, warnCount) {
  try {
    const rolesToRemove = [
      process.env.WARN_1,
      process.env.WARN_2,
      process.env.WARN_3
    ];

    await member.roles.remove(rolesToRemove).catch(() => {});

    if (warnCount === 1) {
      await member.roles.add(process.env.WARN_1);
    } else if (warnCount === 2) {
      await member.roles.add(process.env.WARN_2);
    } else if (warnCount >= 3) {
      if (process.env.WARN_3) {
        await member.roles.add(process.env.WARN_3);
      }
    }

  } catch (err) {
    logger.error(`Erro ao atualizar cargos: ${err.message}`);
  }
}

// ===============================
// 🛠️ UTIL: LOG
// ===============================
async function sendLog(guild, embed) {
  try {
    const channel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (!channel) return;

    await channel.send({ embeds: [embed] });

  } catch (err) {
    logger.error(`Erro ao enviar log: ${err.message}`);
  }
}

// ===============================
// 🚀 EVENT READY
// ===============================
client.once('ready', async () => {
  logger.success(`Bot online como ${client.user.tag}`);
  await registerCommands();
});

// ===============================
// 🎯 INTERACTIONS
// ===============================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const db = loadDB();

  try {
    // ===============================
    // 📊 /WARNSTATS
    // ===============================
    if (interaction.commandName === 'warnstats') {
      const target = interaction.options.getUser('usuario') || interaction.user;
      const userData = db[target.id] || { warns: [] };

      if (!userData.warns.length) {
        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('✅ Usuário Limpo')
          .setDescription(`${target} não possui warns.`)
          .setThumbnail(target.displayAvatarURL())
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(getColorByWarns(userData.warns.length))
        .setTitle('📊 Estatísticas de Warn')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '👤 Usuário', value: `${target}`, inline: true },
          { name: '⚠️ Warns Ativos', value: `${userData.warns.length}`, inline: true },
          { name: '📄 Lista', value: formatWarnList(userData.warns) }
        )
        .setFooter({ text: 'Sistema de Moderação' })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // ===============================
    // ➕ /ADDWARN
    // ===============================
    if (interaction.commandName === 'addwarn') {
      const member = interaction.member;

      if (!isStaff(member)) {
        logger.perm(`${interaction.user.tag} tentou usar /addwarn`);
        return interaction.reply({
          content: '❌ Você não tem permissão.',
          ephemeral: true
        });
      }

      const target = interaction.options.getUser('usuario');
      const reason = interaction.options.getString('motivo');

      if (target.bot) {
        return interaction.reply({
          content: '❌ Não é possível warnar bots.',
          ephemeral: true
        });
      }

      const guildMember = await interaction.guild.members.fetch(target.id);

      if (!db[target.id]) db[target.id] = { warns: [] };

      const warnID = generateWarnID();

      db[target.id].warns.push({
        id: warnID,
        reason,
        date: new Date().toISOString()
      });

      const warnCount = db[target.id].warns.length;

      saveDB(db);

      // ===============================
      // 🎭 CARGOS
      // ===============================
      await updateRoles(guildMember, warnCount);

      // ===============================
      // 📩 DM (2 WARNS)
      // ===============================
      if (warnCount === 2) {
        try {
          await target.send({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.WARNING2)
                .setTitle('⚠️ Aviso Importante')
                .setDescription('Você recebeu 2 warns.')
                .addFields({ name: 'Motivo', value: reason })
                .setTimestamp()
            ]
          });
        } catch {
          logger.warn('Falha ao enviar DM.');
        }
      }

      // ===============================
      // 👢 KICK (3 WARNS)
      // ===============================
      if (warnCount >= 3) {
        try {
          await guildMember.kick('3 warns atingidos');
        } catch (err) {
          logger.error(`Erro ao kickar: ${err.message}`);
        }
      }

      // ===============================
      // 📦 EMBED
      // ===============================
      const embed = new EmbedBuilder()
        .setColor(getColorByWarns(warnCount))
        .setTitle('⚠️ Warn Aplicado')
        .addFields(
          { name: '👤 Usuário', value: `${target}` },
          { name: '📄 Motivo', value: reason },
          { name: '⚠️ Warns Ativos', value: `${warnCount}` },
          { name: '🆔 ID', value: warnID }
        )
        .setFooter({ text: `Aplicado por ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // ===============================
      // 🧾 LOG
      // ===============================
      const logEmbed = new EmbedBuilder()
        .setColor(getColorByWarns(warnCount))
        .setTitle('📜 Log de Moderação')
        .addFields(
          { name: 'Usuário', value: `${target}` },
          { name: 'Staff', value: `${interaction.user}` },
          { name: 'Ação', value: 'Add Warn' },
          { name: 'Warns', value: `${warnCount}` },
          { name: 'ID', value: warnID }
        )
        .setTimestamp();

      await sendLog(interaction.guild, logEmbed);

      logger.success(`Warn aplicado em ${target.tag}`);
    }

    // ===============================
    // ➖ /REMOVEWARN
    // ===============================
    if (interaction.commandName === 'removewarn') {
      const member = interaction.member;

      if (!isStaff(member)) {
        logger.perm(`${interaction.user.tag} tentou usar /removewarn`);
        return interaction.reply({
          content: '❌ Sem permissão.',
          ephemeral: true
        });
      }

      const target = interaction.options.getUser('usuario');

      if (!db[target.id] || db[target.id].warns.length === 0) {
        return interaction.reply({
          content: '❌ Usuário não possui warns.',
          ephemeral: true
        });
      }

      const removed = db[target.id].warns.pop();
      const warnCount = db[target.id].warns.length;

      saveDB(db);

      const guildMember = await interaction.guild.members.fetch(target.id);

      await updateRoles(guildMember, warnCount);

      const embed = new EmbedBuilder()
        .setColor(getColorByWarns(warnCount))
        .setTitle('✅ Warn Removido')
        .addFields(
          { name: '👤 Usuário', value: `${target}` },
          { name: '⚠️ Warns Atuais', value: `${warnCount}` },
          { name: '🆔 ID Removido', value: removed.id }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      const logEmbed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('📜 Log de Moderação')
        .addFields(
          { name: 'Usuário', value: `${target}` },
          { name: 'Staff', value: `${interaction.user}` },
          { name: 'Ação', value: 'Remove Warn' },
          { name: 'Warns', value: `${warnCount}` },
          { name: 'ID', value: removed.id }
        )
        .setTimestamp();

      await sendLog(interaction.guild, logEmbed);

      logger.success(`Warn removido de ${target.tag}`);
    }

  } catch (err) {
    logger.error(err.stack);

    try {
      await interaction.reply({
        content: '❌ Ocorreu um erro.',
        ephemeral: true
      });
    } catch {}
  }
});

// ===============================
// 🛡️ VALIDAÇÕES AVANÇADAS
// ===============================

// Verifica permissões do bot
function checkBotPermissions(guild, member) {
  const botMember = guild.members.me;

  const neededPerms = [
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks
  ];

  const missing = neededPerms.filter(perm => !botMember.permissions.has(perm));

  if (missing.length > 0) {
    logger.perm(`Permissões faltando: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

// ===============================
// 🚫 PROTEÇÃO CONTRA ERROS COMUNS
// ===============================

// Evitar warn em si mesmo
function isSelfWarn(interaction, target) {
  if (interaction.user.id === target.id) {
    return true;
  }
  return false;
}

// Evitar warns negativos
function safeWarnCount(count) {
  if (count < 0) return 0;
  return count;
}

// ===============================
// 🔄 LIMPEZA TOTAL DE CARGOS
// ===============================
async function clearAllWarnRoles(member) {
  try {
    const roles = [
      process.env.WARN_1,
      process.env.WARN_2,
      process.env.WARN_3
    ];

    await member.roles.remove(roles).catch(() => {});
  } catch (err) {
    logger.error(`Erro ao limpar cargos: ${err.message}`);
  }
}

// ===============================
// 📩 DM SEGURA
// ===============================
async function safeDM(user, embed) {
  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch (err) {
    logger.warn(`Falha DM (${user.tag})`);
    return false;
  }
}

// ===============================
// 👢 KICK SEGURO
// ===============================
async function safeKick(member, reason) {
  try {
    if (!member.kickable) {
      logger.error(`Não é possível kickar ${member.user.tag}`);
      return false;
    }

    await member.kick(reason);
    logger.success(`Usuário kickado: ${member.user.tag}`);
    return true;
  } catch (err) {
    logger.error(`Erro ao kickar: ${err.message}`);
    return false;
  }
}

// ===============================
// 🎨 EMBED DE ERRO PADRÃO
// ===============================
function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle('❌ Erro')
    .setDescription(message)
    .setTimestamp();
}

// ===============================
// 🎨 EMBED PERMISSÃO
// ===============================
function permEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle('🚫 Sem Permissão')
    .setDescription('Você não possui permissão para usar este comando.')
    .setTimestamp();
}

// ===============================
// 🔧 MELHORIA NO UPDATE ROLES (SAFE)
// ===============================
async function updateRolesSafe(member, warnCount) {
  try {
    warnCount = safeWarnCount(warnCount);

    await clearAllWarnRoles(member);

    if (warnCount === 1) {
      await member.roles.add(process.env.WARN_1);
    }

    if (warnCount === 2) {
      await member.roles.add(process.env.WARN_2);
    }

    if (warnCount >= 3) {
      if (process.env.WARN_3) {
        await member.roles.add(process.env.WARN_3);
      }
    }

  } catch (err) {
    logger.error(`Erro crítico cargos: ${err.message}`);
  }
}

// ===============================
// 🔁 SOBRESCREVER FUNÇÕES ANTIGAS
// ===============================
global.updateRoles = updateRolesSafe;

// ===============================
// 🧠 MELHORIAS FINAIS DO SISTEMA
// ===============================

// Hook para validar tudo antes dos comandos
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (!checkBotPermissions(interaction.guild, interaction.member)) {
      return interaction.reply({
        embeds: [errorEmbed('O bot não possui permissões suficientes.')],
        ephemeral: true
      });
    }

    const target = interaction.options.getUser('usuario');

    if (target) {
      if (target.bot) {
        return interaction.reply({
          embeds: [errorEmbed('Não é possível usar comandos em bots.')],
          ephemeral: true
        });
      }

      if (isSelfWarn(interaction, target)) {
        return interaction.reply({
          embeds: [errorEmbed('Você não pode fazer isso em si mesmo.')],
          ephemeral: true
        });
      }
    }

  } catch (err) {
    logger.error(`Erro pré-validação: ${err.message}`);
  }
});

// ===============================
// 📦 TRATAMENTO GLOBAL DE ERROS
// ===============================
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
});

// ===============================
// 🔌 LOGIN
// ===============================
client.login(process.env.TOKEN)
  .then(() => logger.success('Login realizado com sucesso.'))
  .catch(err => logger.error(`Erro ao logar: ${err.message}`));

// ===============================
// 🏁 FINALIZAÇÃO
// ===============================
logger.info('Sistema de moderação carregado.');