// ============================================
// DISCORD WARN BOT - SISTEMA COMPLETO DE MODERAÇÃO
// discord.js v14.14.1
// COM LOGS SIMPLIFICADOS
// ============================================

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// ============================================
// EMOJIS PERSONALIZADOS (COMO TEXTO)
// ============================================

const EMOJIS = {
    STAFF: '[STAFF]',
    STAFF_YELLOW: '[STAFF_YELLOW]',
    TICKET_TOOL: '[TICKET]',
    GIT: '[GIT]',
    BOT: '[BOT]',
    EMOJI_40: '[🔴]',
    EMOJI_41: '[🟡]',
    EMOJI_42: '[🟠]',
    EMOJI_43: '[🟢]'
};

// ============================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// ============================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// STAFF ROLES - Array com IDs dos cargos de staff
const STAFF_ROLES = [
  "1392306046655008891",
  "1392306043215679599",
  "1392306051415539774"
];

const WARN_1 = process.env.WARN_1;
const WARN_2 = process.env.WARN_2;
const WARN_3 = process.env.WARN_3;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// Validação inicial das variáveis
if (!TOKEN || !CLIENT_ID) {
    console.log(chalk.bgRed.white('[ERRO FATAL]') + chalk.red(' TOKEN e CLIENT_ID são obrigatórios!'));
    process.exit(1);
}

if (!GUILD_ID) {
    console.log(chalk.bgYellow.black('[AVISO]') + chalk.yellow(' GUILD_ID não configurado.'));
}

// Arquivo de armazenamento de warns
const WARNS_FILE = path.join(__dirname, 'warns.json');

// Estrutura de dados para warns
let warnsDatabase = new Map();
let cachedStaffRoleName = null;
let cachedGuild = null;

// ============================================
// FUNÇÕES DE ARQUIVO E PERSISTÊNCIA
// ============================================

function loadWarnsDatabase() {
    try {
        if (fs.existsSync(WARNS_FILE)) {
            const data = fs.readFileSync(WARNS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            warnsDatabase = new Map(Object.entries(parsed));
            let totalWarns = 0;
            for (const warns of warnsDatabase.values()) {
                totalWarns += warns.length;
            }
            console.log(chalk.green(`✓ Banco de warns carregado: ${warnsDatabase.size} usuários, ${totalWarns} warns`));
        } else {
            warnsDatabase = new Map();
            saveWarnsDatabase();
            console.log(chalk.yellow('✓ Novo banco de warns criado'));
        }
    } catch (error) {
        console.log(chalk.red(`✗ Erro ao carregar banco: ${error.message}`));
        warnsDatabase = new Map();
    }
}

function saveWarnsDatabase() {
    try {
        const object = Object.fromEntries(warnsDatabase);
        fs.writeFileSync(WARNS_FILE, JSON.stringify(object, null, 2));
    } catch (error) {
        console.log(chalk.red(`✗ Erro ao salvar banco: ${error.message}`));
    }
}

let botPermissions = {};

// ============================================
// FUNÇÕES AUXILIARES E UTILITÁRIOS
// ============================================

function generateUniqueWarnId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const sequence = Math.floor(Math.random() * 9000 + 1000).toString();
    return `WRN-${timestamp.toUpperCase()}-${random.toUpperCase()}-${sequence}`;
}

function formatDateBrazilian(date) {
    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });
}

function getWarnLevelColor(warnCount) {
    if (warnCount === 0) return '#2ECC71';
    if (warnCount === 1) return '#F1C40F';
    if (warnCount === 2) return '#E67E22';
    return '#E74C3C';
}

function getWarnLevelIcon(warnCount) {
    if (warnCount === 0) return EMOJIS.EMOJI_43;
    if (warnCount === 1) return EMOJIS.EMOJI_41;
    if (warnCount === 2) return EMOJIS.EMOJI_42;
    return EMOJIS.EMOJI_40;
}

// ============================================
// FUNÇÃO PARA BUSCAR NOME DO CARGO STAFF
// ============================================

async function getStaffRoleName(client) {
    if (cachedStaffRoleName) return cachedStaffRoleName;
    
    try {
        if (!GUILD_ID || GUILD_ID === 'seu_guild_id_aqui') {
            return 'Cargo Staff';
        }
        
        const guild = await client.guilds.fetch(GUILD_ID);
        cachedGuild = guild;
        
        if (STAFF_ROLES && STAFF_ROLES.length > 0) {
            const role = await guild.roles.fetch(STAFF_ROLES[0]);
            if (role) {
                cachedStaffRoleName = role.name;
                return cachedStaffRoleName;
            }
        }
        
        return 'Cargo Staff';
    } catch (error) {
        return 'Cargo Staff';
    }
}

// ============================================
// GERENCIADOR DE WARNS
// ============================================

class WarnManager {
    
    constructor(client) {
        this.client = client;
    }

    async getUserWarns(userId) {
        try {
            if (!warnsDatabase.has(userId)) {
                warnsDatabase.set(userId, []);
                saveWarnsDatabase();
            }
            return warnsDatabase.get(userId);
        } catch (error) {
            return [];
        }
    }

    async addWarn(userId, reason, staffId, staffName) {
        try {
            if (!userId || !reason) {
                throw new Error('Dados incompletos');
            }

            if (!warnsDatabase.has(userId)) {
                warnsDatabase.set(userId, []);
            }

            const warnId = generateUniqueWarnId();
            const currentWarns = warnsDatabase.get(userId);
            
            const warnObject = {
                id: warnId,
                reason: reason,
                date: new Date().toISOString(),
                formattedDate: formatDateBrazilian(new Date()),
                staffId: staffId,
                staffName: staffName,
                warnNumber: currentWarns.length + 1
            };

            currentWarns.push(warnObject);
            warnsDatabase.set(userId, currentWarns);
            saveWarnsDatabase();

            console.log(chalk.green(`✓ Warn adicionado: ${userId} - Total: ${currentWarns.length}/3`));
            
            return {
                success: true,
                warn: warnObject,
                totalWarns: currentWarns.length,
                warnId: warnId
            };
        } catch (error) {
            console.log(chalk.red(`✗ Erro ao adicionar warn: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    async removeWarn(userId, warnId, staffId, staffName) {
        try {
            if (!warnsDatabase.has(userId)) {
                return { success: false, error: 'Usuário não possui warns' };
            }

            const currentWarns = warnsDatabase.get(userId);
            const warnIndex = currentWarns.findIndex(w => w.id === warnId);
            
            if (warnIndex === -1) {
                return { success: false, error: 'Warn não encontrado' };
            }

            const removedWarn = currentWarns.splice(warnIndex, 1)[0];
            
            currentWarns.forEach((warn, idx) => {
                warn.warnNumber = idx + 1;
            });
            
            warnsDatabase.set(userId, currentWarns);
            saveWarnsDatabase();

            console.log(chalk.yellow(`✓ Warn removido: ${userId} - Agora: ${currentWarns.length}/3`));
            
            return {
                success: true,
                removedWarn: removedWarn,
                totalWarns: currentWarns.length
            };
        } catch (error) {
            console.log(chalk.red(`✗ Erro ao remover warn: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    async getWarnCount(userId) {
        try {
            if (!warnsDatabase.has(userId)) return 0;
            return warnsDatabase.get(userId).length;
        } catch (error) {
            return 0;
        }
    }

    async getAllWarnsFormatted(userId) {
        try {
            const warns = await this.getUserWarns(userId);
            if (warns.length === 0) return null;
            
            let formattedList = '';
            for (let i = 0; i < warns.length; i++) {
                const warn = warns[i];
                const icon = i === 0 ? EMOJIS.EMOJI_41 : (i === 1 ? EMOJIS.EMOJI_42 : EMOJIS.EMOJI_40);
                formattedList += `${icon} **#${warn.warnNumber}** \`${warn.id}\`\n`;
                formattedList += `   📝 Motivo: ${warn.reason}\n`;
                formattedList += `   📅 Data: ${warn.formattedDate}\n`;
                formattedList += `   ${EMOJIS.STAFF} Staff: ${warn.staffName}\n`;
                if (i < warns.length - 1) formattedList += '\n';
            }
            return formattedList;
        } catch (error) {
            return null;
        }
    }
}

// ============================================
// GERENCIADOR DE CARGOS E PUNIÇÕES
// ============================================

class PunishmentManager {
    
    constructor(client, warnManager) {
        this.client = client;
        this.warnManager = warnManager;
    }

    async checkBotPermissions(guild) {
        try {
            const botMember = await guild.members.fetch(this.client.user.id);
            
            botPermissions.hasManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
            botPermissions.hasKickMembers = botMember.permissions.has(PermissionsBitField.Flags.KickMembers);
            botPermissions.hasSendMessages = botMember.permissions.has(PermissionsBitField.Flags.SendMessages);
            botPermissions.hasViewChannel = botMember.permissions.has(PermissionsBitField.Flags.ViewChannel);
            
            const missingPerms = [];
            if (!botPermissions.hasManageRoles) missingPerms.push('ManageRoles');
            if (!botPermissions.hasKickMembers) missingPerms.push('KickMembers');
            
            if (missingPerms.length > 0) {
                console.log(chalk.yellow(`⚠ Bot sem permissões: ${missingPerms.join(', ')}`));
                return false;
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    async removeAllWarnRoles(member) {
        try {
            if (WARN_1 && WARN_1 !== 'id_do_cargo_warn_1') {
                const role = await member.guild.roles.fetch(WARN_1).catch(() => null);
                if (role && member.roles.cache.has(WARN_1)) {
                    await member.roles.remove(role);
                }
            }
            
            if (WARN_2 && WARN_2 !== 'id_do_cargo_warn_2') {
                const role = await member.guild.roles.fetch(WARN_2).catch(() => null);
                if (role && member.roles.cache.has(WARN_2)) {
                    await member.roles.remove(role);
                }
            }
            
            if (WARN_3 && WARN_3 !== 'id_do_cargo_warn_3') {
                const role = await member.guild.roles.fetch(WARN_3).catch(() => null);
                if (role && member.roles.cache.has(WARN_3)) {
                    await member.roles.remove(role);
                }
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async applyWarnRole(member, warnCount) {
        try {
            if (!member) return { success: false, error: 'Membro não encontrado' };
            
            await this.removeAllWarnRoles(member);
            
            if (warnCount === 0) {
                console.log(chalk.green(`✓ Cargos removidos: ${member.user.tag}`));
                return { success: true, action: 'all_removed' };
            }
            
            let roleId = null;
            let roleName = '';
            
            if (warnCount === 1 && WARN_1 && WARN_1 !== 'id_do_cargo_warn_1') {
                roleId = WARN_1;
                roleName = 'WARN 1';
            } else if (warnCount === 2 && WARN_2 && WARN_2 !== 'id_do_cargo_warn_2') {
                roleId = WARN_2;
                roleName = 'WARN 2';
            } else if (warnCount >= 3 && WARN_3 && WARN_3 !== 'id_do_cargo_warn_3') {
                roleId = WARN_3;
                roleName = 'WARN 3';
            }
            
            if (roleId) {
                const role = await member.guild.roles.fetch(roleId).catch(() => null);
                if (role) {
                    if (!botPermissions.hasManageRoles) {
                        return { success: false, error: 'Bot sem permissão ManageRoles' };
                    }
                    
                    await member.roles.add(role);
                    console.log(chalk.green(`✓ Cargo aplicado: ${member.user.tag} - ${roleName}`));
                    return { success: true, action: 'role_applied', roleName };
                }
            }
            
            return { success: true, action: 'no_role_needed' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendWarningDM(member, warnCount, warnReason, warnId) {
        try {
            let dmEmbed;
            
            if (warnCount === 2) {
                dmEmbed = new EmbedBuilder()
                    .setColor('#E67E22')
                    .setTitle(`${EMOJIS.EMOJI_42} ATENÇÃO - SEGUNDA ADVERTÊNCIA`)
                    .setDescription(`Você recebeu uma advertência no servidor **${member.guild.name}**`)
                    .setThumbnail(member.guild.iconURL({ dynamic: true }))
                    .addFields(
                        { name: '📊 Nível Atual', value: '**2/3** - Segundo aviso', inline: true },
                        { name: `${EMOJIS.TICKET_TOOL} ID do Warn`, value: `\`${warnId}\``, inline: true },
                        { name: '📝 Motivo', value: warnReason, inline: false },
                        { name: '⚠️ Consequência', value: 'Uma próxima advertência resultará em **expulsão** do servidor', inline: false },
                        { name: '📅 Data', value: formatDateBrazilian(new Date()), inline: true }
                    )
                    .setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação Automática` })
                    .setTimestamp();
            } else {
                dmEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle(`${EMOJIS.EMOJI_40} LIMITE MÁXIMO ATINGIDO - EXPULSÃO`)
                    .setDescription(`Você atingiu o limite máximo de 3 advertências no servidor **${member.guild.name}**`)
                    .setThumbnail(member.guild.iconURL({ dynamic: true }))
                    .addFields(
                        { name: '📊 Nível Final', value: '**3/3** - Limite excedido', inline: true },
                        { name: `${EMOJIS.TICKET_TOOL} Último Warn`, value: `\`${warnId}\``, inline: true },
                        { name: '📝 Último Motivo', value: warnReason, inline: false },
                        { name: '🚫 Ação Tomada', value: 'Você foi **expulso(a)** do servidor', inline: false },
                        { name: '📅 Data', value: formatDateBrazilian(new Date()), inline: true }
                    )
                    .setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação Automática` })
                    .setTimestamp();
            }
            
            await member.send({ embeds: [dmEmbed] });
            console.log(chalk.blue(`✓ DM enviada para ${member.user.tag}`));
            return { success: true };
        } catch (error) {
            if (error.code === 50007) {
                console.log(chalk.yellow(`⚠ DM bloqueada: ${member.user.tag}`));
                return { success: false, error: 'DM bloqueada' };
            }
            return { success: false, error: error.message };
        }
    }

    async kickMember(member, reason, warnCount) {
        try {
            if (!member.kickable) {
                return { success: false, error: 'Bot não pode kickar' };
            }
            
            if (!botPermissions.hasKickMembers) {
                return { success: false, error: 'Bot sem permissão KickMembers' };
            }
            
            const kickReason = `Acumulou ${warnCount}/3 warns - Motivo: ${reason}`;
            await member.kick(kickReason);
            
            console.log(chalk.red(`✗ Usuário expulso: ${member.user.tag}`));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async processPunishments(member, warnCount, lastWarnReason, lastWarnId) {
        try {
            const results = {
                rolesUpdated: false,
                dmSent: false,
                kicked: false,
                errors: []
            };
            
            const roleResult = await this.applyWarnRole(member, warnCount);
            if (roleResult.success) {
                results.rolesUpdated = true;
            } else {
                results.errors.push(`Erro nos cargos: ${roleResult.error}`);
            }
            
            if (warnCount === 2) {
                const dmResult = await this.sendWarningDM(member, warnCount, lastWarnReason, lastWarnId);
                if (dmResult.success) {
                    results.dmSent = true;
                }
            }
            
            if (warnCount >= 3) {
                const kickResult = await this.kickMember(member, lastWarnReason, warnCount);
                if (kickResult.success) {
                    results.kicked = true;
                }
            }
            
            return results;
        } catch (error) {
            return { errors: [error.message] };
        }
    }
}

// ============================================
// GERENCIADOR DE LOGS
// ============================================

class LogManager {
    
    constructor(client) {
        this.client = client;
    }

    async sendModerationLog(user, staff, action, details) {
        try {
            if (!LOG_CHANNEL_ID || LOG_CHANNEL_ID === 'id_do_canal_de_logs') {
                return { success: false };
            }

            const logChannel = await this.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) {
                return { success: false };
            }

            let embedColor;
            let embedTitle;
            let embedDescription;

            switch (action) {
                case 'ADDWARN':
                    embedColor = details.warnCount === 1 ? '#F1C40F' : (details.warnCount === 2 ? '#E67E22' : '#E74C3C');
                    embedTitle = `${EMOJIS.EMOJI_41} ADIÇÃO DE ADVERTÊNCIA`;
                    embedDescription = `Uma nova advertência foi registrada`;
                    break;
                case 'REMOVEWARN':
                    embedColor = '#2ECC71';
                    embedTitle = `${EMOJIS.EMOJI_43} REMOÇÃO DE ADVERTÊNCIA`;
                    embedDescription = `Uma advertência foi removida do histórico`;
                    break;
                case 'KICK':
                    embedColor = '#E74C3C';
                    embedTitle = `${EMOJIS.EMOJI_40} EXPULSÃO AUTOMÁTICA`;
                    embedDescription = `Um usuário foi expulso`;
                    break;
                default:
                    embedColor = '#3498DB';
                    embedTitle = `${EMOJIS.TICKET_TOOL} AÇÃO DE MODERAÇÃO`;
                    embedDescription = `Uma ação foi registrada`;
            }

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(embedTitle)
                .setDescription(embedDescription)
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👤 Usuário', value: `${user.tag}\n(${user.id})`, inline: true },
                    { name: `${EMOJIS.STAFF} Staff`, value: `${staff.tag}\n(${staff.id})`, inline: true },
                    { name: '📅 Data/Hora', value: formatDateBrazilian(new Date()), inline: true }
                );

            if (action === 'ADDWARN') {
                embed.addFields(
                    { name: `${EMOJIS.TICKET_TOOL} ID do Warn`, value: `\`${details.warnId}\``, inline: true },
                    { name: '⚠️ Warns', value: `${details.warnCount}/3`, inline: true },
                    { name: '📝 Motivo', value: details.reason || 'Não especificado', inline: false }
                );
            } else if (action === 'REMOVEWARN') {
                embed.addFields(
                    { name: `${EMOJIS.TICKET_TOOL} Warn Removido`, value: `\`${details.warnId}\``, inline: true },
                    { name: '⚠️ Warns Restantes', value: `${details.warnCount}/3`, inline: true }
                );
            } else if (action === 'KICK') {
                embed.addFields(
                    { name: '🚫 Motivo', value: details.reason || 'Limite de warns excedido', inline: false },
                    { name: '⚠️ Total de Warns', value: `${details.warnCount}/3`, inline: true }
                );
            }

            embed.setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação` }).setTimestamp();

            await logChannel.send({ embeds: [embed] });
            return { success: true };

        } catch (error) {
            return { success: false };
        }
    }

    getStatusEmoji(warnCount) {
        if (warnCount === 0) return `${EMOJIS.EMOJI_43} Limpo`;
        if (warnCount === 1) return `${EMOJIS.EMOJI_41} Nível 1`;
        if (warnCount === 2) return `${EMOJIS.EMOJI_42} Nível 2`;
        return `${EMOJIS.EMOJI_40} Nível 3`;
    }

    async sendErrorLog(command, error, user, interaction) {
        console.log(chalk.red(`✗ Erro em ${command}: ${error.message}`));
    }
}

// ============================================
// SISTEMA DE COMANDOS SLASH
// ============================================

const commands = [
    new SlashCommandBuilder()
        .setName('warnstats')
        .setDescription(`${EMOJIS.EMOJI_41} Mostra o histórico completo de warns de um usuário`)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Selecione o usuário para consultar')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('detalhado')
                .setDescription('Mostrar informações detalhadas')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('addwarn')
        .setDescription(`${EMOJIS.EMOJI_40} Adiciona uma advertência a um usuário`)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário que receberá a advertência')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da advertência')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('detalhes')
                .setDescription('Detalhes adicionais')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('removewarn')
        .setDescription(`${EMOJIS.EMOJI_43} Remove a ÚLTIMA advertência de um usuário`)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário que terá a última advertência removida')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da remoção')
                .setRequired(false))
];

// ============================================
// VERIFICAÇÃO DE PERMISSÃO STAFF - SIMPLIFICADA
// ============================================

async function checkStaffPermission(interaction) {
    try {
        await interaction.guild?.fetch();
        
        const member = interaction.member;
        
        if (!member) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ERRO`)
                .setDescription('Não foi possível verificar suas permissões.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return false;
        }

        if (!STAFF_ROLES || STAFF_ROLES.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ERRO DE CONFIGURAÇÃO`)
                .setDescription('Os cargos de staff não foram configurados.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return false;
        }

        const memberRoles = member.roles.cache;
        const hasStaffRole = memberRoles.some(role => STAFF_ROLES.includes(role.id));
        
        if (!hasStaffRole) {
            const denyEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ACESSO NEGADO`)
                .setDescription('Você não tem permissão para executar este comando.')
                .addFields(
                    { name: '🔑 Permissão Necessária', value: 'Cargo de Staff', inline: true }
                )
                .setTimestamp();
            await interaction.reply({ embeds: [denyEmbed], ephemeral: true });
            return false;
        }

        return true;

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ERRO`)
            .setDescription(`Erro ao verificar permissão: ${error.message}`)
            .setTimestamp();
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        return false;
    }
}

// ============================================
// VERIFICAÇÃO DE PERMISSÃO DO BOT
// ============================================

async function checkBotPermissionsForAction(interaction, action) {
    try {
        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        const missingPerms = [];

        if (action === 'addwarn' || action === 'removewarn') {
            if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                missingPerms.push('ManageRoles');
            }
        }

        if (action === 'kick') {
            if (!botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                missingPerms.push('KickMembers');
            }
        }

        if (missingPerms.length > 0) {
            const permEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} PERMISSÕES INSUFICIENTES`)
                .setDescription('O bot não possui as permissões necessárias.')
                .addFields(
                    { name: '🔧 Permissões Faltando', value: missingPerms.map(p => `\`${p}\``).join(', '), inline: false }
                )
                .setTimestamp();
            await interaction.reply({ embeds: [permEmbed], ephemeral: true });
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

// ============================================
// HANDLER DO COMANDO /warnstats
// ============================================

async function handleWarnStats(interaction) {
    try {
        const targetUser = interaction.options.getUser('usuario');
        const detailed = interaction.options.getBoolean('detalhado') || false;

        if (!targetUser) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ERRO`)
                .setDescription('Usuário não encontrado.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        if (targetUser.bot) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} OPERAÇÃO INVÁLIDA`)
                .setDescription('Bots não podem receber advertências.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const warns = await warnManager.getUserWarns(targetUser.id);
        const warnCount = warns.length;
        const warnIcon = getWarnLevelIcon(warnCount);

        let member = null;
        let joinDate = null;
        let roles = [];
        try {
            member = await interaction.guild.members.fetch(targetUser.id);
            joinDate = member.joinedAt;
            roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).slice(0, 5);
        } catch (error) {}

        if (warnCount === 0) {
            const cleanEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle(`${warnIcon} HISTÓRICO DE ADVERTÊNCIAS - LIMPO`)
                .setDescription(`O usuário **${targetUser.tag}** não possui nenhuma advertência registrada.`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👤 Usuário', value: `${targetUser.tag}`, inline: true },
                    { name: '⚠️ Total de Warns', value: '**0**', inline: true },
                    { name: '📊 Status', value: `${EMOJIS.EMOJI_43} Limpo`, inline: true }
                )
                .setFooter({ text: `${EMOJIS.BOT} Consulta por ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({ embeds: [cleanEmbed], ephemeral: true });
            return;
        }

        let warnsList = '';

        for (let i = 0; i < warns.length; i++) {
            const warn = warns[i];
            const warnIconLevel = i === 0 ? EMOJIS.EMOJI_41 : (i === 1 ? EMOJIS.EMOJI_42 : EMOJIS.EMOJI_40);
            
            warnsList += `${warnIconLevel} **#${warn.warnNumber}** - \`${warn.id}\`\n`;
            warnsList += `   📝 ${warn.reason}\n`;
            warnsList += `   📅 ${warn.formattedDate}\n`;
            warnsList += `   ${EMOJIS.STAFF} ${warn.staffName}\n`;
            if (i < warns.length - 1) warnsList += '\n';
        }

        let statusMessage = '';
        let statusColor = '';
        if (warnCount === 1) {
            statusMessage = `${EMOJIS.EMOJI_41} Primeira Advertência`;
            statusColor = '#F1C40F';
        } else if (warnCount === 2) {
            statusMessage = `${EMOJIS.EMOJI_42} Segunda Advertência`;
            statusColor = '#E67E22';
        } else {
            statusMessage = `${EMOJIS.EMOJI_40} Limite Atingido`;
            statusColor = '#E74C3C';
        }

        const statsEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle(`${warnIcon} HISTÓRICO DE ADVERTÊNCIAS`)
            .setDescription(`**Usuário:** ${targetUser.tag}\n**Total:** ${warnCount}/3`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Usuário', value: `${targetUser.tag}`, inline: true },
                { name: '⚠️ Total', value: `**${warnCount}**/3`, inline: true },
                { name: '📊 Status', value: statusMessage, inline: false },
                { name: '📋 WARNS', value: warnsList.substring(0, 1024) || 'Nenhum', inline: false }
            )
            .setFooter({ text: `${EMOJIS.BOT} Consulta por ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [statsEmbed], ephemeral: true });

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ERRO`)
            .setDescription('Ocorreu um erro ao buscar o histórico.')
            .setTimestamp();
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// ============================================
// HANDLER DO COMANDO /addwarn
// ============================================

async function handleAddWarn(interaction) {
    try {
        const hasStaffPermission = await checkStaffPermission(interaction);
        if (!hasStaffPermission) return;

        const botHasPerms = await checkBotPermissionsForAction(interaction, 'addwarn');
        if (!botHasPerms) return;

        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo');
        const details = interaction.options.getString('detalhes') || '';

        if (!targetUser) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ERRO`)
                .setDescription('Usuário não encontrado.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        if (targetUser.bot) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} OPERAÇÃO INVÁLIDA`)
                .setDescription('Não é possível adicionar advertências a bots.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} USUÁRIO NÃO ENCONTRADO`)
                .setDescription('O usuário não está mais no servidor.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        if (targetUser.id === interaction.user.id) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} AUTO-ADVERTÊNCIA`)
                .setDescription('Você não pode adicionar uma advertência a si mesmo.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const fullReason = details ? `${reason}\n📌 Detalhes: ${details}` : reason;

        const result = await warnManager.addWarn(targetUser.id, fullReason, interaction.user.id, interaction.user.tag);

        if (!result.success) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} FALHA AO ADICIONAR WARN`)
                .setDescription(`Erro: ${result.error}`)
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const warnCount = result.totalWarns;
        const warnId = result.warnId;

        const punishmentResults = await punishmentManager.processPunishments(member, warnCount, fullReason, warnId);

        let embedColor;
        let embedTitle;
        let embedDescription;
        let actionMessage = '';

        if (warnCount === 1) {
            embedColor = '#F1C40F';
            embedTitle = `${EMOJIS.EMOJI_41} ADVERTÊNCIA REGISTRADA - NÍVEL 1`;
            embedDescription = `Advertência adicionada a **${targetUser.tag}**`;
            actionMessage = 'Cargo de advertência nível 1 aplicado.';
        } else if (warnCount === 2) {
            embedColor = '#E67E22';
            embedTitle = `${EMOJIS.EMOJI_42} SEGUNDA ADVERTÊNCIA - NÍVEL 2`;
            embedDescription = `Segunda advertência para **${targetUser.tag}**`;
            actionMessage = '• DM de aviso enviada\n• Próxima advertência = expulsão';
        } else {
            embedColor = '#E74C3C';
            embedTitle = `${EMOJIS.EMOJI_40} LIMITE MÁXIMO ATINGIDO - EXPULSÃO`;
            embedDescription = `**${targetUser.tag}** atingiu o limite de 3 advertências`;
            actionMessage = '• Usuário EXPULSO do servidor';
        }

        const responseEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Usuário', value: `${targetUser.tag}`, inline: true },
                { name: `${EMOJIS.STAFF} Staff`, value: `${interaction.user.tag}`, inline: true },
                { name: `${EMOJIS.TICKET_TOOL} ID`, value: `\`${warnId}\``, inline: true },
                { name: '⚠️ Total', value: `${warnCount}/3`, inline: true },
                { name: '📝 Motivo', value: fullReason.length > 100 ? fullReason.substring(0, 100) + '...' : fullReason, inline: false },
                { name: '⚡ Ações', value: actionMessage, inline: false }
            )
            .setFooter({ text: `${EMOJIS.BOT} ${formatDateBrazilian(new Date())}` })
            .setTimestamp();

        await interaction.reply({ embeds: [responseEmbed], ephemeral: true });

        await logManager.sendModerationLog(targetUser, interaction.user, 'ADDWARN', {
            warnId: warnId,
            warnCount: warnCount,
            reason: fullReason
        });

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ERRO CRÍTICO`)
            .setDescription(`Erro: ${error.message}`)
            .setTimestamp();
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// ============================================
// HANDLER DO COMANDO /removewarn - SIMPLIFICADO
// ============================================

async function handleRemoveWarn(interaction) {
    try {
        const hasStaffPermission = await checkStaffPermission(interaction);
        if (!hasStaffPermission) return;

        const botHasPerms = await checkBotPermissionsForAction(interaction, 'removewarn');
        if (!botHasPerms) return;

        const targetUser = interaction.options.getUser('usuario');
        const removalReason = interaction.options.getString('motivo') || 'Removido por staff';

        if (!targetUser) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ERRO`)
                .setDescription('Usuário não encontrado.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        if (targetUser.bot) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} OPERAÇÃO INVÁLIDA`)
                .setDescription('Bots não possuem advertências.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const currentWarns = await warnManager.getUserWarns(targetUser.id);
        
        if (currentWarns.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} NENHUM WARN ENCONTRADO`)
                .setDescription(`**${targetUser.tag}** não possui advertências.`)
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const lastWarn = currentWarns[currentWarns.length - 1];
        const warnId = lastWarn.id;

        const result = await warnManager.removeWarn(targetUser.id, warnId, interaction.user.id, interaction.user.tag);

        if (!result.success) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} FALHA AO REMOVER WARN`)
                .setDescription(`Erro: ${result.error}`)
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const newWarnCount = result.totalWarns;
        const removedWarn = result.removedWarn;

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (member) {
            await punishmentManager.applyWarnRole(member, newWarnCount);
        }

        let embedColor;
        let statusMessage;

        if (newWarnCount === 0) {
            embedColor = '#2ECC71';
            statusMessage = `${EMOJIS.EMOJI_43} Histórico limpo`;
        } else if (newWarnCount === 1) {
            embedColor = '#F1C40F';
            statusMessage = `${EMOJIS.EMOJI_41} Nível 1`;
        } else if (newWarnCount === 2) {
            embedColor = '#E67E22';
            statusMessage = `${EMOJIS.EMOJI_42} Nível 2`;
        } else {
            embedColor = '#E74C3C';
            statusMessage = `${EMOJIS.EMOJI_40} Nível 3`;
        }

        const responseEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${EMOJIS.EMOJI_43} ADVERTÊNCIA REMOVIDA`)
            .setDescription(`A última advertência foi removida de **${targetUser.tag}**`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Usuário', value: `${targetUser.tag}`, inline: true },
                { name: `${EMOJIS.STAFF} Staff`, value: `${interaction.user.tag}`, inline: true },
                { name: `${EMOJIS.TICKET_TOOL} Warn Removido`, value: `\`${removedWarn.id}\``, inline: true },
                { name: '📝 Motivo Original', value: removedWarn.reason.length > 100 ? removedWarn.reason.substring(0, 100) + '...' : removedWarn.reason, inline: false },
                { name: '⚠️ Warns Restantes', value: `${newWarnCount}/3`, inline: true },
                { name: '📊 Status', value: statusMessage, inline: true }
            )
            .setFooter({ text: `${EMOJIS.BOT} Remoção registrada em ${formatDateBrazilian(new Date())}` })
            .setTimestamp();

        await interaction.reply({ embeds: [responseEmbed], ephemeral: true });

        await logManager.sendModerationLog(targetUser, interaction.user, 'REMOVEWARN', {
            warnId: removedWarn.id,
            warnCount: newWarnCount,
            originalReason: removedWarn.reason,
            removalReason: removalReason
        });

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ERRO AO REMOVER`)
            .setDescription(`Erro: ${error.message}`)
            .setTimestamp();
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// ============================================
// HANDLER PRINCIPAL DE INTERAÇÕES
// ============================================

async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case 'warnstats':
            await handleWarnStats(interaction);
            break;
        case 'addwarn':
            await handleAddWarn(interaction);
            break;
        case 'removewarn':
            await handleRemoveWarn(interaction);
            break;
        default:
            console.log(chalk.yellow(`⚠ Comando desconhecido: ${interaction.commandName}`));
    }
}

// ============================================
// REGISTRO DE COMANDOS GLOBAIS
// ============================================

async function registerGlobalCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        
        console.log(chalk.blue('✓ Registrando comandos slash...'));

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );

        console.log(chalk.green('✓ Comandos registrados com sucesso!'));
    } catch (error) {
        console.log(chalk.red(`✗ Erro ao registrar comandos: ${error.message}`));
    }
}

// ============================================
// EVENTOS DO CLIENTE
// ============================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const warnManager = new WarnManager(client);
const punishmentManager = new PunishmentManager(client, warnManager);
const logManager = new LogManager(client);

client.once('ready', async () => {
    console.log(chalk.green(`\n✓ Bot online: ${client.user.tag}`));
    console.log(chalk.gray(`✓ Servidores: ${client.guilds.cache.size}`));
    
    console.log(chalk.cyan('\n[CONFIG]'));
    console.log(chalk.gray(`  STAFF_ROLES: ${STAFF_ROLES.length > 0 ? '✓' : '✗'}`));
    console.log(chalk.gray(`  WARN_1: ${WARN_1 && WARN_1 !== 'id_do_cargo_warn_1' ? '✓' : '✗'}`));
    console.log(chalk.gray(`  WARN_2: ${WARN_2 && WARN_2 !== 'id_do_cargo_warn_2' ? '✓' : '✗'}`));
    console.log(chalk.gray(`  WARN_3: ${WARN_3 && WARN_3 !== 'id_do_cargo_warn_3' ? '✓' : '✗'}`));
    console.log(chalk.gray(`  LOG_CHANNEL: ${LOG_CHANNEL_ID && LOG_CHANNEL_ID !== 'id_do_canal_de_logs' ? '✓' : '✗'}\n`));
    
    loadWarnsDatabase();
    await registerGlobalCommands();
    
    for (const guild of client.guilds.cache.values()) {
        await punishmentManager.checkBotPermissions(guild);
    }
    
    client.user.setPresence({
        activities: [{
            name: `𝙼𝚊𝚍𝚎 𝙱𝚢 𝚈𝟸𝚔_𝙽𝚊𝚝`,
            type: 1
        }],
        status: 'online'
    });
    
    console.log(chalk.green('✓ Bot pronto!\n'));
});

client.on('interactionCreate', handleInteraction);

client.on('guildMemberAdd', async (member) => {
    const warns = await warnManager.getUserWarns(member.id);
    if (warns.length > 0) {
        await punishmentManager.applyWarnRole(member, warns.length);
        console.log(chalk.blue(`✓ Cargos restaurados: ${member.user.tag} (${warns.length} warns)`));
    }
});

// ============================================
// BACKUP AUTOMÁTICO
// ============================================

setInterval(() => {
    saveWarnsDatabase();
}, 300000);

// ============================================
// TRATAMENTO DE SINAIS DO SISTEMA
// ============================================

process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⚠ Salvando dados...'));
    saveWarnsDatabase();
    console.log(chalk.green('✓ Encerrando bot...\n'));
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.log(chalk.red(`✗ Erro não tratado: ${error.message}`));
    saveWarnsDatabase();
});

process.on('unhandledRejection', (reason) => {
    console.log(chalk.red(`✗ Promise rejeitada: ${reason}`));
    saveWarnsDatabase();
});

// ============================================
// INICIALIZAÇÃO DO BOT
// ============================================

console.log(chalk.blue('\n✓ Iniciando bot...\n'));

client.login(TOKEN).catch(error => {
    console.log(chalk.red(`✗ Falha no login: ${error.message}`));
    process.exit(1);
});

// ============================================
// FIM DO CÓDIGO
// ============================================
