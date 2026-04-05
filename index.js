// ============================================
// DISCORD WARN BOT - SISTEMA COMPLETO DE MODERAÇÃO
// discord.js v14.14.1
// COM LOGS MELHORADOS E MODULARIZAÇÃO
// ============================================

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
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
  "1392306051415539774",
  "1392306074987659449",
  "1392306082289811670"
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

// Cache de Membros
const memberCache = new Map();
const MEMBER_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

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
// GERENCIADOR DE ERROS
// ============================================

class ErrorHandler {
    constructor(client, logManager) {
        this.client = client;
        this.logManager = logManager;
    }

    async handleError(error, context = {}) {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            code: error.code,
            context: context,
            timestamp: new Date().toISOString()
        };

        // Log no console com cores
        console.log(chalk.bgRed.white('[ERRO]') + chalk.red(` ${error.message}`));
        if (context.command) {
            console.log(chalk.red(`  Comando: ${context.command}`));
        }
        if (context.user) {
            console.log(chalk.red(`  Usuário: ${context.user.tag} (${context.user.id})`));
        }
        console.log(chalk.gray(`  Stack: ${error.stack?.split('\n')[1] || 'N/A'}`));

        // Enviar para o canal de logs se disponível
        if (this.logManager && LOG_CHANNEL_ID && LOG_CHANNEL_ID !== 'id_do_canal_de_logs') {
            await this.logManager.sendErrorLog(errorInfo);
        }

        return errorInfo;
    }

    async handleInteractionError(interaction, error, commandName) {
        const errorEmbed = this.logManager?.createErrorEmbed(
            'ERRO NA EXECUÇÃO',
            `Ocorreu um erro ao executar o comando **${commandName}**`,
            error.message
        );

        const flags = MessageFlags.Ephemeral;
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], flags }).catch(() => {});
        } else {
            await interaction.reply({ embeds: [errorEmbed], flags }).catch(() => {});
        }

        await this.handleError(error, { command: commandName, user: interaction.user });
    }
}

// ============================================
// EMBED HELPER
// ============================================

class EmbedHelper {
    static createSuccessEmbed(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle(`${EMOJIS.EMOJI_43} ${title}`)
            .setDescription(description)
            .setTimestamp();
        
        if (fields.length > 0) {
            embed.addFields(fields);
        }
        
        return embed;
    }

    static createErrorEmbed(title, description, errorDetails = null) {
        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ${title}`)
            .setDescription(description)
            .setTimestamp();
        
        if (errorDetails) {
            embed.addFields({ name: '📋 Detalhes', value: `\`${errorDetails}\``, inline: false });
        }
        
        return embed;
    }

    static createWarningEmbed(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle(`${EMOJIS.EMOJI_41} ${title}`)
            .setDescription(description)
            .setTimestamp();
        
        if (fields.length > 0) {
            embed.addFields(fields);
        }
        
        return embed;
    }

    static createInfoEmbed(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle(`${EMOJIS.TICKET_TOOL} ${title}`)
            .setDescription(description)
            .setTimestamp();
        
        if (fields.length > 0) {
            embed.addFields(fields);
        }
        
        return embed;
    }
}

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
// GERENCIADOR DE CACHE DE MEMBROS
// ============================================

class MemberCacheManager {
    constructor(client) {
        this.client = client;
        this.cache = new Map();
    }

    async getMember(guildId, userId) {
        const cacheKey = `${guildId}:${userId}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < MEMBER_CACHE_TTL) {
            console.log(chalk.gray(`[Cache] Hit: ${userId}`));
            return cached.member;
        }
        
        try {
            const guild = await this.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            
            this.cache.set(cacheKey, {
                member: member,
                timestamp: Date.now()
            });
            
            console.log(chalk.gray(`[Cache] Miss - Fetched: ${userId}`));
            return member;
        } catch (error) {
            console.log(chalk.yellow(`[Cache] Erro ao buscar membro ${userId}: ${error.message}`));
            return null;
        }
    }

    async getMemberSafe(guild, userId) {
        try {
            if (guild.members.cache.has(userId)) {
                return guild.members.cache.get(userId);
            }
            
            return await this.getMember(guild.id, userId);
        } catch (error) {
            return null;
        }
    }

    invalidateMember(guildId, userId) {
        const cacheKey = `${guildId}:${userId}`;
        this.cache.delete(cacheKey);
        console.log(chalk.gray(`[Cache] Invalidated: ${userId}`));
    }

    clearCache() {
        this.cache.clear();
        console.log(chalk.gray('[Cache] Cleared all entries'));
    }
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
            console.log(chalk.red(`✗ Erro ao buscar warns: ${error.message}`));
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
            botPermissions.hasBanMembers = botMember.permissions.has(PermissionsBitField.Flags.BanMembers);
            botPermissions.hasSendMessages = botMember.permissions.has(PermissionsBitField.Flags.SendMessages);
            botPermissions.hasViewChannel = botMember.permissions.has(PermissionsBitField.Flags.ViewChannel);
            
            const missingPerms = [];
            if (!botPermissions.hasManageRoles) missingPerms.push('ManageRoles');
            if (!botPermissions.hasBanMembers) missingPerms.push('BanMembers');
            
            if (missingPerms.length > 0) {
                console.log(chalk.yellow(`⚠ Bot sem permissões: ${missingPerms.join(', ')}`));
                return false;
            }
            
            return true;
        } catch (error) {
            console.log(chalk.red(`✗ Erro ao verificar permissões: ${error.message}`));
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
            console.log(chalk.red(`✗ Erro ao remover cargos: ${error.message}`));
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
            console.log(chalk.red(`✗ Erro ao aplicar cargo: ${error.message}`));
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
                        { name: '⚠️ Consequência', value: 'Uma próxima advertência resultará em **banimento** do servidor', inline: false },
                        { name: '📅 Data', value: formatDateBrazilian(new Date()), inline: true }
                    )
                    .setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação Automática` })
                    .setTimestamp();
            } else {
                dmEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle(`${EMOJIS.EMOJI_40} LIMITE MÁXIMO ATINGIDO - BANIMENTO`)
                    .setDescription(`Você atingiu o limite máximo de 3 advertências no servidor **${member.guild.name}**`)
                    .setThumbnail(member.guild.iconURL({ dynamic: true }))
                    .addFields(
                        { name: '📊 Nível Final', value: '**3/3** - Limite excedido', inline: true },
                        { name: `${EMOJIS.TICKET_TOOL} Último Warn`, value: `\`${warnId}\``, inline: true },
                        { name: '📝 Último Motivo', value: warnReason, inline: false },
                        { name: '🚫 Ação Tomada', value: 'Você foi **banido(a)** do servidor', inline: false },
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
            console.log(chalk.red(`✗ Erro ao enviar DM: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    async banMember(member, reason, warnCount) {
        try {
            if (!member.bannable) {
                return { success: false, error: 'Bot não pode banir este usuário (cargo mais alto ou sem permissão)' };
            }
            
            if (!botPermissions.hasBanMembers) {
                return { success: false, error: 'Bot sem permissão BanMembers' };
            }
            
            const banReason = `Acumulou ${warnCount}/3 warns - Motivo: ${reason}`;
            await member.ban({ reason: banReason });
            
            console.log(chalk.red(`✗ Usuário banido: ${member.user.tag}`));
            return { success: true };
        } catch (error) {
            console.log(chalk.red(`✗ Erro ao banir: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    async processPunishments(member, warnCount, lastWarnReason, lastWarnId) {
        try {
            const results = {
                rolesUpdated: false,
                dmSent: false,
                banned: false,
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
                const banResult = await this.banMember(member, lastWarnReason, warnCount);
                if (banResult.success) {
                    results.banned = true;
                } else {
                    results.errors.push(`Erro ao banir: ${banResult.error}`);
                }
            }
            
            return results;
        } catch (error) {
            console.log(chalk.red(`✗ Erro no processamento de punições: ${error.message}`));
            return { errors: [error.message] };
        }
    }
}

// ============================================
// GERENCIADOR DE LOGS MELHORADO
// ============================================

class LogManager {
    
    constructor(client) {
        this.client = client;
        this.logChannel = null;
    }

    async getLogChannel() {
        if (this.logChannel) return this.logChannel;
        
        if (!LOG_CHANNEL_ID || LOG_CHANNEL_ID === 'id_do_canal_de_logs') {
            return null;
        }
        
        try {
            this.logChannel = await this.client.channels.fetch(LOG_CHANNEL_ID);
            return this.logChannel;
        } catch (error) {
            console.log(chalk.yellow(`⚠ Não foi possível obter canal de logs: ${error.message}`));
            return null;
        }
    }

    async sendModerationLog(user, staff, action, details) {
        try {
            const logChannel = await this.getLogChannel();
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
                case 'BAN':
                    embedColor = '#E74C3C';
                    embedTitle = `${EMOJIS.EMOJI_40} BANIMENTO AUTOMÁTICO`;
                    embedDescription = `Um usuário foi banido`;
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
            } else if (action === 'BAN') {
                embed.addFields(
                    { name: '🚫 Motivo', value: details.reason || 'Limite de warns excedido', inline: false },
                    { name: '⚠️ Total de Warns', value: `${details.warnCount}/3`, inline: true }
                );
            }

            embed.setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação` }).setTimestamp();

            await logChannel.send({ embeds: [embed] });
            console.log(chalk.blue(`[LOG] ${action} - ${user.tag} por ${staff.tag}`));
            return { success: true };

        } catch (error) {
            console.log(chalk.red(`✗ Erro ao enviar log de moderação: ${error.message}`));
            return { success: false };
        }
    }

    async sendErrorLog(errorInfo) {
        try {
            const logChannel = await this.getLogChannel();
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ERRO NO SISTEMA`)
                .setDescription(`Ocorreu um erro no sistema de moderação`)
                .addFields(
                    { name: '📝 Mensagem', value: `\`\`\`${errorInfo.message.substring(0, 1000)}\`\`\``, inline: false },
                    { name: '📍 Contexto', value: `\`\`\`json\n${JSON.stringify(errorInfo.context, null, 2).substring(0, 500)}\`\`\``, inline: false },
                    { name: '⏰ Data/Hora', value: formatDateBrazilian(new Date(errorInfo.timestamp)), inline: true }
                )
                .setFooter({ text: `${EMOJIS.BOT} Sistema de Erros` })
                .setTimestamp();

            if (errorInfo.code) {
                embed.addFields({ name: '🔢 Código', value: `\`${errorInfo.code}\``, inline: true });
            }

            await logChannel.send({ embeds: [embed] });
            console.log(chalk.blue(`[LOG] Erro registrado: ${errorInfo.message}`));
        } catch (error) {
            console.log(chalk.red(`✗ Erro ao enviar log de erro: ${error.message}`));
        }
    }

    async sendSystemLog(message, type = 'INFO') {
        try {
            const logChannel = await this.getLogChannel();
            if (!logChannel) return;

            const colors = {
                INFO: '#3498DB',
                WARNING: '#F1C40F',
                ERROR: '#E74C3C',
                SUCCESS: '#2ECC71'
            };

            const icons = {
                INFO: 'ℹ️',
                WARNING: '⚠️',
                ERROR: '❌',
                SUCCESS: '✅'
            };

            const embed = new EmbedBuilder()
                .setColor(colors[type] || '#3498DB')
                .setTitle(`${icons[type] || 'ℹ️'} LOG DO SISTEMA`)
                .setDescription(message)
                .setFooter({ text: `${EMOJIS.BOT} ${formatDateBrazilian(new Date())}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
            console.log(chalk.blue(`[SYS] ${type}: ${message.substring(0, 100)}`));
        } catch (error) {
            console.log(chalk.red(`✗ Erro ao enviar log do sistema: ${error.message}`));
        }
    }

    getStatusEmoji(warnCount) {
        if (warnCount === 0) return `${EMOJIS.EMOJI_43} Limpo`;
        if (warnCount === 1) return `${EMOJIS.EMOJI_41} Nível 1`;
        if (warnCount === 2) return `${EMOJIS.EMOJI_42} Nível 2`;
        return `${EMOJIS.EMOJI_40} Nível 3`;
    }

    createErrorEmbed(title, description, errorDetails = null) {
        return EmbedHelper.createErrorEmbed(title, description, errorDetails);
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
            const errorEmbed = EmbedHelper.createErrorEmbed(
                'ERRO',
                'Não foi possível verificar suas permissões.'
            );
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return false;
        }

        if (!STAFF_ROLES || STAFF_ROLES.length === 0) {
            const errorEmbed = EmbedHelper.createErrorEmbed(
                'ERRO DE CONFIGURAÇÃO',
                'Os cargos de staff não foram configurados.'
            );
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return false;
        }

        const memberRoles = member.roles.cache;
        const hasStaffRole = memberRoles.some(role => STAFF_ROLES.includes(role.id));
        
        if (!hasStaffRole) {
            const denyEmbed = EmbedHelper.createErrorEmbed(
                'ACESSO NEGADO',
                'Você não tem permissão para executar este comando.'
            ).addFields({ name: '🔑 Permissão Necessária', value: 'Cargo de Staff', inline: true });
            
            await interaction.reply({ embeds: [denyEmbed], flags: MessageFlags.Ephemeral });
            return false;
        }

        return true;

    } catch (error) {
        const errorEmbed = EmbedHelper.createErrorEmbed(
            'ERRO',
            `Erro ao verificar permissão: ${error.message}`
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
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

        if (action === 'ban') {
            if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                missingPerms.push('BanMembers');
            }
        }

        if (missingPerms.length > 0) {
            const permEmbed = EmbedHelper.createErrorEmbed(
                'PERMISSÕES INSUFICIENTES',
                'O bot não possui as permissões necessárias.'
            ).addFields({ name: '🔧 Permissões Faltando', value: missingPerms.map(p => `\`${p}\``).join(', '), inline: false });
            
            await interaction.reply({ embeds: [permEmbed], flags: MessageFlags.Ephemeral });
            return false;
        }

        return true;
    } catch (error) {
        console.log(chalk.red(`✗ Erro ao verificar permissões do bot: ${error.message}`));
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
            const errorEmbed = EmbedHelper.createErrorEmbed('ERRO', 'Usuário não encontrado.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (targetUser.bot) {
            const errorEmbed = EmbedHelper.createErrorEmbed('OPERAÇÃO INVÁLIDA', 'Bots não podem receber advertências.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const warns = await warnManager.getUserWarns(targetUser.id);
        const warnCount = warns.length;
        const warnIcon = getWarnLevelIcon(warnCount);

        let member = null;
        let joinDate = null;
        let roles = [];
        try {
            member = await memberCacheManager.getMember(interaction.guild.id, targetUser.id);
            if (member) {
                joinDate = member.joinedAt;
                roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).slice(0, 5);
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠ Não foi possível buscar membro: ${error.message}`));
        }

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

            await interaction.reply({ embeds: [cleanEmbed], flags: MessageFlags.Ephemeral });
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

        await interaction.reply({ embeds: [statsEmbed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        await errorHandler.handleInteractionError(interaction, error, 'warnstats');
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
            const errorEmbed = EmbedHelper.createErrorEmbed('ERRO', 'Usuário não encontrado.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (targetUser.bot) {
            const errorEmbed = EmbedHelper.createErrorEmbed('OPERAÇÃO INVÁLIDA', 'Não é possível adicionar advertências a bots.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const member = await memberCacheManager.getMember(interaction.guild.id, targetUser.id);
        if (!member) {
            const errorEmbed = EmbedHelper.createErrorEmbed('USUÁRIO NÃO ENCONTRADO', 'O usuário não está mais no servidor.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (targetUser.id === interaction.user.id) {
            const errorEmbed = EmbedHelper.createErrorEmbed('AUTO-ADVERTÊNCIA', 'Você não pode adicionar uma advertência a si mesmo.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const fullReason = details ? `${reason}\n📌 Detalhes: ${details}` : reason;

        const result = await warnManager.addWarn(targetUser.id, fullReason, interaction.user.id, interaction.user.tag);

        if (!result.success) {
            const errorEmbed = EmbedHelper.createErrorEmbed('FALHA AO ADICIONAR WARN', `Erro: ${result.error}`);
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
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
            actionMessage = '• DM de aviso enviada\n• Próxima advertência = BANIMENTO';
        } else {
            embedColor = '#E74C3C';
            embedTitle = `${EMOJIS.EMOJI_40} LIMITE MÁXIMO ATINGIDO - BANIMENTO`;
            embedDescription = `**${targetUser.tag}** atingiu o limite de 3 advertências`;
            actionMessage = '• Usuário BANIDO do servidor';
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

        await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });

        if (warnCount >= 3) {
            await logManager.sendModerationLog(targetUser, interaction.user, 'BAN', {
                warnCount: warnCount,
                reason: fullReason
            });
        } else {
            await logManager.sendModerationLog(targetUser, interaction.user, 'ADDWARN', {
                warnId: warnId,
                warnCount: warnCount,
                reason: fullReason
            });
        }

        // Invalidate member cache after adding warn
        memberCacheManager.invalidateMember(interaction.guild.id, targetUser.id);

    } catch (error) {
        await errorHandler.handleInteractionError(interaction, error, 'addwarn');
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
            const errorEmbed = EmbedHelper.createErrorEmbed('ERRO', 'Usuário não encontrado.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (targetUser.bot) {
            const errorEmbed = EmbedHelper.createErrorEmbed('OPERAÇÃO INVÁLIDA', 'Bots não possuem advertências.');
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const currentWarns = await warnManager.getUserWarns(targetUser.id);
        
        if (currentWarns.length === 0) {
            const errorEmbed = EmbedHelper.createErrorEmbed('NENHUM WARN ENCONTRADO', `**${targetUser.tag}** não possui advertências.`);
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const lastWarn = currentWarns[currentWarns.length - 1];
        const warnId = lastWarn.id;

        const result = await warnManager.removeWarn(targetUser.id, warnId, interaction.user.id, interaction.user.tag);

        if (!result.success) {
            const errorEmbed = EmbedHelper.createErrorEmbed('FALHA AO REMOVER WARN', `Erro: ${result.error}`);
            await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            return;
        }

        const newWarnCount = result.totalWarns;
        const removedWarn = result.removedWarn;

        const member = await memberCacheManager.getMember(interaction.guild.id, targetUser.id);
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

        await interaction.reply({ embeds: [responseEmbed], flags: MessageFlags.Ephemeral });

        await logManager.sendModerationLog(targetUser, interaction.user, 'REMOVEWARN', {
            warnId: removedWarn.id,
            warnCount: newWarnCount,
            originalReason: removedWarn.reason,
            removalReason: removalReason
        });

        // Invalidate member cache after removing warn
        memberCacheManager.invalidateMember(interaction.guild.id, targetUser.id);

    } catch (error) {
        await errorHandler.handleInteractionError(interaction, error, 'removewarn');
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
        await logManager.sendSystemLog('Comandos slash registrados com sucesso!', 'SUCCESS');
    } catch (error) {
        console.log(chalk.red(`✗ Erro ao registrar comandos: ${error.message}`));
        await logManager.sendSystemLog(`Erro ao registrar comandos: ${error.message}`, 'ERROR');
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
const memberCacheManager = new MemberCacheManager(client);
const errorHandler = new ErrorHandler(client, logManager);

// Limpeza periódica do cache de membros
setInterval(() => {
    memberCacheManager.clearCache();
    console.log(chalk.gray('[Cache] Limpeza automática executada'));
}, 30 * 60 * 1000); // 30 minutos

client.once('clientReady', async () => {
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
    
    // Verificar permissões do bot em todos os servidores
    for (const guild of client.guilds.cache.values()) {
        const perms = await punishmentManager.checkBotPermissions(guild);
        console.log(chalk.gray(`  ${guild.name}: BanMembers=${botPermissions.hasBanMembers}, ManageRoles=${botPermissions.hasManageRoles}`));
        
        if (!botPermissions.hasBanMembers) {
            console.log(chalk.yellow(`  ⚠ AVISO: Bot sem permissão de BANIR em ${guild.name}`));
            await logManager.sendSystemLog(`Bot sem permissão de BANIR em ${guild.name}`, 'WARNING');
        }
        if (!botPermissions.hasManageRoles) {
            console.log(chalk.yellow(`  ⚠ AVISO: Bot sem permissão de gerenciar cargos em ${guild.name}`));
        }
    }
    
    client.user.setPresence({
        activities: [{
            name: `𝙼𝚊𝚍𝚎 𝙱𝚢 𝚈𝟸𝚔_𝙽𝚊𝚝`,
            type: 1
        }],
        status: 'online'
    });
    
    console.log(chalk.green('✓ Bot pronto!\n'));
    await logManager.sendSystemLog('Bot iniciado e pronto para uso!', 'SUCCESS');
});

client.on('interactionCreate', handleInteraction);

client.on('guildMemberAdd', async (member) => {
    try {
        const warns = await warnManager.getUserWarns(member.id);
        if (warns.length > 0) {
            await punishmentManager.applyWarnRole(member, warns.length);
            console.log(chalk.blue(`✓ Cargos restaurados: ${member.user.tag} (${warns.length} warns)`));
            await logManager.sendSystemLog(`Cargos restaurados para ${member.user.tag} (${warns.length} warns)`, 'INFO');
        }
        // Adicionar ao cache
        memberCacheManager.getMember(member.guild.id, member.id);
    } catch (error) {
        console.log(chalk.red(`✗ Erro ao restaurar cargos: ${error.message}`));
    }
});

// ============================================
// BACKUP AUTOMÁTICO
// ============================================

setInterval(() => {
    saveWarnsDatabase();
    console.log(chalk.gray('[Backup] Banco de dados salvo automaticamente'));
}, 2800000);

// ============================================
// TRATAMENTO DE SINAIS DO SISTEMA
// ============================================

process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n⚠ Salvando dados...'));
    saveWarnsDatabase();
    await logManager.sendSystemLog('Bot encerrado via SIGINT', 'INFO');
    console.log(chalk.green('✓ Encerrando bot...\n'));
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n⚠ Salvando dados...'));
    saveWarnsDatabase();
    await logManager.sendSystemLog('Bot encerrado via SIGTERM', 'INFO');
    console.log(chalk.green('✓ Encerrando bot...\n'));
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.log(chalk.red(`✗ Erro não tratado: ${error.message}`));
    console.log(chalk.gray(error.stack));
    await errorHandler.handleError(error, { type: 'uncaughtException' });
    saveWarnsDatabase();
});

process.on('unhandledRejection', async (reason) => {
    console.log(chalk.red(`✗ Promise rejeitada: ${reason}`));
    await errorHandler.handleError(new Error(String(reason)), { type: 'unhandledRejection' });
    saveWarnsDatabase();
});

// ============================================
// INICIALIZAÇÃO DO BOT
// ============================================

console.log(chalk.blue('\n✓ Iniciando bot...\n'));

client.login(TOKEN).catch(async error => {
    console.log(chalk.red(`✗ Falha no login: ${error.message}`));
    await errorHandler.handleError(error, { type: 'login' });
    process.exit(1);
});
