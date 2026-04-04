// ============================================
// DISCORD WARN BOT - SISTEMA COMPLETO DE MODERAÇÃO
// discord.js v14.14.1
// COM GUILD_ID E NOME DO CARGO NOS EMBEDS
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
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
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
    console.log(chalk.bgYellow.black('[AVISO]') + chalk.yellow(' GUILD_ID não configurado. Recomendado para funcionamento correto.'));
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
            console.log(chalk.cyan(`${EMOJIS.EMOJI_43}[SISTEMA]`) + chalk.green(` Banco de warns carregado: ${warnsDatabase.size} usuários`));
            
            let totalWarns = 0;
            for (const warns of warnsDatabase.values()) {
                totalWarns += warns.length;
            }
            console.log(chalk.cyan(`${EMOJIS.EMOJI_42}[SISTEMA]`) + chalk.gray(` Total de warns registrados: ${totalWarns}`));
        } else {
            warnsDatabase = new Map();
            saveWarnsDatabase();
            console.log(chalk.cyan(`${EMOJIS.EMOJI_43}[SISTEMA]`) + chalk.yellow(' Novo banco de warns criado'));
        }
    } catch (error) {
        console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO CRÍTICO]`) + chalk.red(` Falha ao carregar banco de dados: ${error.message}`));
        console.log(chalk.gray(error.stack));
        warnsDatabase = new Map();
    }
}

function saveWarnsDatabase() {
    try {
        const object = Object.fromEntries(warnsDatabase);
        fs.writeFileSync(WARNS_FILE, JSON.stringify(object, null, 2));
        console.log(chalk.gray(`${EMOJIS.GIT}[BACKUP] Banco de dados salvo - ${new Date().toLocaleTimeString()}`));
    } catch (error) {
        console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` Falha ao salvar banco de dados: ${error.message}`));
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
// FUNÇÃO PARA BUSCAR NOME DO CARGO STAFF
// ============================================

async function getStaffRoleName(client) {
    if (cachedStaffRoleName) return cachedStaffRoleName;
    
    try {
        if (!GUILD_ID || GUILD_ID === 'seu_guild_id_aqui') {
            return 'Cargo Staff (configure GUILD_ID)';
        }
        
        const guild = await client.guilds.fetch(GUILD_ID);
        cachedGuild = guild;
        
        if (STAFF_ROLE_ID && STAFF_ROLE_ID !== 'id_do_cargo_staff') {
            const role = await guild.roles.fetch(STAFF_ROLE_ID);
            if (role) {
                cachedStaffRoleName = role.name;
                return cachedStaffRoleName;
            }
        }
        
        return 'Cargo Staff (não encontrado)';
    } catch (error) {
        console.log(chalk.red(`${EMOJIS.EMOJI_40}[ERRO] Buscar nome do cargo: ${error.message}`));
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
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` getUserWarns falhou: ${error.message}`));
            return [];
        }
    }

    async addWarn(userId, reason, staffId, staffName) {
        try {
            if (!userId || !reason) {
                throw new Error('Dados incompletos para adicionar warn');
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

            console.log(chalk.green(`${EMOJIS.EMOJI_43}[ADDWARN] ${chalk.bold(warnId)} adicionado ao usuário ${userId} por ${staffName}`));
            
            return {
                success: true,
                warn: warnObject,
                totalWarns: currentWarns.length,
                warnId: warnId
            };
        } catch (error) {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` addWarn falhou: ${error.message}`));
            console.log(chalk.gray(error.stack));
            return { success: false, error: error.message };
        }
    }

    async removeWarn(userId, warnId, staffId, staffName) {
        try {
            if (!warnsDatabase.has(userId)) {
                return { success: false, error: 'Usuário não possui nenhum warn registrado' };
            }

            const currentWarns = warnsDatabase.get(userId);
            const warnIndex = currentWarns.findIndex(w => w.id === warnId);
            
            if (warnIndex === -1) {
                return { success: false, error: `Warn com ID ${warnId} não encontrado para este usuário` };
            }

            const removedWarn = currentWarns.splice(warnIndex, 1)[0];
            
            currentWarns.forEach((warn, idx) => {
                warn.warnNumber = idx + 1;
            });
            
            warnsDatabase.set(userId, currentWarns);
            saveWarnsDatabase();

            console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[REMOVEWARN] ${chalk.bold(warnId)} removido do usuário ${userId} por ${staffName}`));
            
            return {
                success: true,
                removedWarn: removedWarn,
                totalWarns: currentWarns.length
            };
        } catch (error) {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` removeWarn falhou: ${error.message}`));
            console.log(chalk.gray(error.stack));
            return { success: false, error: error.message };
        }
    }

    async getWarnCount(userId) {
        try {
            if (!warnsDatabase.has(userId)) return 0;
            return warnsDatabase.get(userId).length;
        } catch (error) {
            console.log(chalk.red(`${EMOJIS.EMOJI_40}[ERRO] getWarnCount: ${error.message}`));
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
            console.log(chalk.red(`${EMOJIS.EMOJI_40}[ERRO] getAllWarnsFormatted: ${error.message}`));
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
                console.log(chalk.bgYellow.black(`${EMOJIS.STAFF_YELLOW}[PERMISSÃO]`) + chalk.yellow(` Bot sem permissões: ${missingPerms.join(', ')}`));
                return false;
            }
            
            return true;
        } catch (error) {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` checkBotPermissions falhou: ${error.message}`));
            return false;
        }
    }

    async removeAllWarnRoles(member) {
        try {
            let removedCount = 0;
            
            if (WARN_1 && WARN_1 !== 'id_do_cargo_warn_1') {
                const role = await member.guild.roles.fetch(WARN_1).catch(() => null);
                if (role && member.roles.cache.has(WARN_1)) {
                    await member.roles.remove(role);
                    removedCount++;
                    console.log(chalk.gray(`${EMOJIS.GIT}[CARGOS] Cargo ${role.name} removido de ${member.user.tag}`));
                }
            }
            
            if (WARN_2 && WARN_2 !== 'id_do_cargo_warn_2') {
                const role = await member.guild.roles.fetch(WARN_2).catch(() => null);
                if (role && member.roles.cache.has(WARN_2)) {
                    await member.roles.remove(role);
                    removedCount++;
                    console.log(chalk.gray(`${EMOJIS.GIT}[CARGOS] Cargo ${role.name} removido de ${member.user.tag}`));
                }
            }
            
            if (WARN_3 && WARN_3 !== 'id_do_cargo_warn_3') {
                const role = await member.guild.roles.fetch(WARN_3).catch(() => null);
                if (role && member.roles.cache.has(WARN_3)) {
                    await member.roles.remove(role);
                    removedCount++;
                    console.log(chalk.gray(`${EMOJIS.GIT}[CARGOS] Cargo ${role.name} removido de ${member.user.tag}`));
                }
            }
            
            return { success: true, removedCount };
        } catch (error) {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` removeAllWarnRoles falhou: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    async applyWarnRole(member, warnCount) {
        try {
            if (!member) return { success: false, error: 'Membro não encontrado' };
            
            await this.removeAllWarnRoles(member);
            
            if (warnCount === 0) {
                console.log(chalk.green(`${EMOJIS.EMOJI_43}[CARGOS] ${member.user.tag} - Todos os cargos de warn removidos (0 warns)`));
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
                        console.log(chalk.bgYellow.black(`${EMOJIS.STAFF_YELLOW}[PERMISSÃO]`) + chalk.yellow(` Bot sem permissão ManageRoles para aplicar ${roleName}`));
                        return { success: false, error: 'Bot sem permissão ManageRoles' };
                    }
                    
                    await member.roles.add(role);
                    console.log(chalk.green(`${EMOJIS.EMOJI_43}[CARGOS] ${member.user.tag} - Cargo ${roleName} aplicado (${warnCount} warns)`));
                    return { success: true, action: 'role_applied', roleName };
                } else {
                    console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[AVISO] Cargo ${roleName} (${roleId}) não encontrado no servidor`));
                }
            }
            
            return { success: true, action: 'no_role_needed' };
        } catch (error) {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` applyWarnRole falhou: ${error.message}`));
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
            console.log(chalk.green(`${EMOJIS.EMOJI_43}[DM] Mensagem enviada para ${member.user.tag} (${warnCount} warns)`));
            return { success: true };
        } catch (error) {
            if (error.code === 50007) {
                console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[DM] Falha ao enviar DM para ${member.user.tag}: Usuário com DMs bloqueadas`));
                return { success: false, error: 'DM bloqueada pelo usuário' };
            }
            console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[DM] Falha ao enviar DM: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    async kickMember(member, reason, warnCount) {
        try {
            if (!member.kickable) {
                console.log(chalk.bgYellow.black(`${EMOJIS.STAFF_YELLOW}[PERMISSÃO]`) + chalk.yellow(` Bot não pode kickar ${member.user.tag}`));
                return { success: false, error: 'Bot não tem permissão para kickar este usuário' };
            }
            
            if (!botPermissions.hasKickMembers) {
                console.log(chalk.bgYellow.black(`${EMOJIS.STAFF_YELLOW}[PERMISSÃO]`) + chalk.yellow(' Bot sem permissão KickMembers'));
                return { success: false, error: 'Bot sem permissão KickMembers' };
            }
            
            const kickReason = `Acumulou ${warnCount}/3 warns - Limite máximo atingido | Motivo do último warn: ${reason}`;
            await member.kick(kickReason);
            
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[KICK]`) + chalk.red(` ${member.user.tag} foi expulso do servidor (${warnCount} warns)`));
            return { success: true };
        } catch (error) {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` kickMember falhou: ${error.message}`));
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
                } else {
                    results.errors.push(`Erro na DM: ${dmResult.error}`);
                }
            }
            
            if (warnCount >= 3) {
                const kickResult = await this.kickMember(member, lastWarnReason, warnCount);
                if (kickResult.success) {
                    results.kicked = true;
                } else {
                    results.errors.push(`Erro no kick: ${kickResult.error}`);
                }
            }
            
            return results;
        } catch (error) {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` processPunishments falhou: ${error.message}`));
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
                console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[LOG] Canal de logs não configurado`));
                return { success: false, error: 'Canal de logs não configurado' };
            }

            const logChannel = await this.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) {
                console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[LOG] Canal ${LOG_CHANNEL_ID} não encontrado`));
                return { success: false, error: 'Canal de logs não encontrado' };
            }

            let embedColor;
            let embedTitle;
            let embedDescription;

            switch (action) {
                case 'ADDWARN':
                    embedColor = details.warnCount === 1 ? '#F1C40F' : (details.warnCount === 2 ? '#E67E22' : '#E74C3C');
                    embedTitle = `${EMOJIS.EMOJI_41} ADIÇÃO DE ADVERTÊNCIA`;
                    embedDescription = `Uma nova advertência foi registrada no sistema`;
                    break;
                case 'REMOVEWARN':
                    embedColor = '#2ECC71';
                    embedTitle = `${EMOJIS.EMOJI_43} REMOÇÃO DE ADVERTÊNCIA`;
                    embedDescription = `Uma advertência foi removida do histórico`;
                    break;
                case 'KICK':
                    embedColor = '#E74C3C';
                    embedTitle = `${EMOJIS.EMOJI_40} EXPULSÃO AUTOMÁTICA`;
                    embedDescription = `Um usuário foi expulso por atingir o limite de warns`;
                    break;
                default:
                    embedColor = '#3498DB';
                    embedTitle = `${EMOJIS.TICKET_TOOL} AÇÃO DE MODERAÇÃO`;
                    embedDescription = `Uma ação foi registrada no sistema`;
            }

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(embedTitle)
                .setDescription(embedDescription)
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👤 Usuário', value: `${user.tag}\n(${user.id})`, inline: true },
                    { name: `${EMOJIS.STAFF} Staff Responsável`, value: `${staff.tag}\n(${staff.id})`, inline: true },
                    { name: '📅 Data/Hora', value: formatDateBrazilian(new Date()), inline: true }
                );

            if (action === 'ADDWARN') {
                embed.addFields(
                    { name: `${EMOJIS.TICKET_TOOL} ID do Warn`, value: `\`${details.warnId}\``, inline: true },
                    { name: '⚠️ Warns Atuais', value: `${details.warnCount}/3`, inline: true },
                    { name: '📝 Motivo', value: details.reason || 'Não especificado', inline: false },
                    { name: '📊 Status do Usuário', value: this.getStatusEmoji(details.warnCount), inline: true }
                );
            } else if (action === 'REMOVEWARN') {
                embed.addFields(
                    { name: `${EMOJIS.TICKET_TOOL} Warn Removido`, value: `\`${details.warnId}\``, inline: true },
                    { name: '📝 Motivo Original', value: details.originalReason || 'Não especificado', inline: false },
                    { name: '⚠️ Warns Restantes', value: `${details.warnCount}/3`, inline: true },
                    { name: '📊 Novo Status', value: this.getStatusEmoji(details.warnCount), inline: true }
                );
            } else if (action === 'KICK') {
                embed.addFields(
                    { name: '🚫 Motivo da Expulsão', value: details.reason || 'Limite de warns excedido', inline: false },
                    { name: '⚠️ Total de Warns', value: `${details.warnCount}/3`, inline: true },
                    { name: `${EMOJIS.TICKET_TOOL} Último Warn`, value: `\`${details.lastWarnId}\``, inline: true }
                );
            }

            if (details.consequences && details.consequences.length > 0) {
                embed.addFields({
                    name: '⚡ Ações Aplicadas',
                    value: details.consequences.map(c => `• ${c}`).join('\n'),
                    inline: false
                });
            }

            if (details.errors && details.errors.length > 0) {
                embed.addFields({
                    name: `${EMOJIS.EMOJI_40} Erros Encontrados`,
                    value: details.errors.map(e => `• ${e}`).join('\n').substring(0, 1024),
                    inline: false
                });
                embed.setColor('#E74C3C');
            }

            embed.setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação • ID: ${details.warnId || 'N/A'}`, iconURL: this.client.user.displayAvatarURL() })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
            console.log(chalk.cyan(`${EMOJIS.GIT}[LOG] ${action} registrado no canal #${logChannel.name}`));
            return { success: true };

        } catch (error) {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO LOG]`) + chalk.red(` Falha ao enviar log: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    getStatusEmoji(warnCount) {
        if (warnCount === 0) return `${EMOJIS.EMOJI_43} Limpo`;
        if (warnCount === 1) return `${EMOJIS.EMOJI_41} Nível 1 - Atenção`;
        if (warnCount === 2) return `${EMOJIS.EMOJI_42} Nível 2 - Crítico`;
        return `${EMOJIS.EMOJI_40} Nível 3 - Banido`;
    }

    async sendErrorLog(command, error, user, interaction) {
        try {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO DETALHADO]`));
            console.log(chalk.red(`├─ Comando: ${command}`));
            console.log(chalk.red(`├─ Usuário: ${user?.tag || 'Desconhecido'}`));
            console.log(chalk.red(`├─ Mensagem: ${error.message}`));
            console.log(chalk.red(`└─ Stack: ${error.stack?.split('\n')[1]?.trim() || 'N/A'}`));

            if (LOG_CHANNEL_ID && LOG_CHANNEL_ID !== 'id_do_canal_de_logs') {
                const logChannel = await this.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle(`${EMOJIS.EMOJI_40} ERRO NO SISTEMA`)
                        .setDescription(`Ocorreu um erro durante a execução do comando \`${command}\``)
                        .addFields(
                            { name: '📝 Comando', value: command, inline: true },
                            { name: '👤 Usuário', value: user?.tag || 'Desconhecido', inline: true },
                            { name: `${EMOJIS.EMOJI_40} Erro`, value: `\`\`\`js\n${error.message.substring(0, 500)}\`\`\``, inline: false }
                        )
                        .setFooter({ text: `${EMOJIS.BOT} Stack: ${error.stack?.split('\n')[1]?.trim() || 'N/A'}` })
                        .setTimestamp();

                    await logChannel.send({ embeds: [errorEmbed] });
                }
            }
        } catch (logError) {
            console.log(chalk.red(`${EMOJIS.EMOJI_40}[ERRO] Falha ao logar erro: ${logError.message}`));
        }
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
                .setDescription('Mostrar informações detalhadas (padrão: false)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('addwarn')
        .setDescription(`${EMOJIS.EMOJI_40} Adiciona uma advertência a um usuário (Staff apenas)`)
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
                .setDescription('Detalhes adicionais (opcional)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('removewarn')
        .setDescription(`${EMOJIS.EMOJI_43} Remove uma advertência específica de um usuário (Staff apenas)`)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário que terá a advertência removida')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID da advertência a ser removida')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da remoção (opcional)')
                .setRequired(false))
];

// ============================================
// VERIFICAÇÃO DE PERMISSÃO STAFF - CORRIGIDA COM NOME DO CARGO
// ============================================

async function checkStaffPermission(interaction) {
    try {
        // Aguardar o guild estar disponível
        await interaction.guild?.fetch();
        
        const member = interaction.member;
        
        if (!member) {
            console.log(chalk.red(`${EMOJIS.EMOJI_40}[ERRO] Membro não encontrado na interação`));
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ERRO`)
                .setDescription('Não foi possível verificar suas permissões. Tente novamente.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return false;
        }

        // Verificar se STAFF_ROLE_ID está configurado
        if (!STAFF_ROLE_ID || STAFF_ROLE_ID === 'id_do_cargo_staff' || STAFF_ROLE_ID === 'SEU_ID_AQUI') {
            console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO CONFIG]`) + chalk.red(' STAFF_ROLE_ID não configurado corretamente no .env'));
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ERRO DE CONFIGURAÇÃO`)
                .setDescription('O cargo de staff não foi configurado corretamente no arquivo `.env`')
                .addFields(
                    { name: '🔧 Solução', value: 'Configure `STAFF_ROLE_ID` com o ID do cargo de staff', inline: false },
                    { name: '📝 Como obter o ID', value: '1. Ative o Modo Desenvolvedor no Discord\n2. Clique com botão direito no cargo\n3. Copiar ID', inline: false },
                    { name: '⚙️ Configuração atual', value: `\`${STAFF_ROLE_ID || 'Não definido'}\``, inline: false }
                )
                .setFooter({ text: `${EMOJIS.BOT} Contate um administrador do servidor` })
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return false;
        }

        // Buscar o cargo para obter o NOME (não o ID)
        let staffRole = null;
        let staffRoleName = 'Cargo Staff';
        
        try {
            staffRole = await interaction.guild.roles.fetch(STAFF_ROLE_ID);
            if (staffRole) {
                staffRoleName = staffRole.name;
                console.log(chalk.green(`${EMOJIS.EMOJI_43}[DEBUG] Cargo staff encontrado: ${staffRoleName} (ID: ${STAFF_ROLE_ID})`));
            } else {
                console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` Cargo ${STAFF_ROLE_ID} não encontrado no servidor`));
            }
        } catch (error) {
            console.log(chalk.red(`${EMOJIS.EMOJI_40}[ERRO] Falha ao buscar cargo: ${error.message}`));
        }

        // Verificar se o membro tem o cargo
        const memberRoles = member.roles.cache;
        const hasStaffRole = memberRoles.has(STAFF_ROLE_ID);
        
        // DEBUG - Mostrar informações no console
        console.log(chalk.cyan(`${EMOJIS.GIT}[DEBUG PERMISSÃO]`));
        console.log(chalk.gray(`├─ Usuário: ${member.user.tag}`));
        console.log(chalk.gray(`├─ Cargo Staff Nome: ${staffRoleName}`));
        console.log(chalk.gray(`├─ Cargo Staff ID: ${STAFF_ROLE_ID}`));
        console.log(chalk.gray(`├─ Tem o cargo? ${hasStaffRole ? 'SIM ✓' : 'NÃO ✗'}`));
        console.log(chalk.gray(`├─ Cargos do usuário: ${memberRoles.map(r => `${r.name}`).join(', ') || 'Nenhum'}`));
        
        // Se não tiver o cargo staff - MOSTRA O NOME DO CARGO, NÃO O ID
        if (!hasStaffRole) {
            const denyEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} ACESSO NEGADO`)
                .setDescription('Você não tem permissão para executar este comando.')
                .addFields(
                    { name: '🔑 Cargo Necessário', value: `\`${staffRoleName}\``, inline: true },
                    { name: `${EMOJIS.STAFF} Seus Cargos`, value: memberRoles.map(r => `\`${r.name}\``).join(', ') || '`Nenhum cargo`', inline: false },
                    { name: '📌 Ação', value: 'Este comando é restrito à equipe de moderação', inline: false }
                )
                .setThumbnail('https://cdn.discordapp.com/emojis/890394788519342150.png')
                .setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação • ${member.user.tag}`, iconURL: member.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [denyEmbed], ephemeral: true });
            console.log(chalk.bgYellow.black(`${EMOJIS.STAFF_YELLOW}[PERMISSÃO NEGADA]`) + chalk.yellow(` ${member.user.tag} tentou usar ${interaction.commandName} sem o cargo ${staffRoleName}`));
            return false;
        }

        console.log(chalk.green(`${EMOJIS.EMOJI_43}[PERMISSÃO OK] ${member.user.tag} (${staffRoleName}) autorizado para ${interaction.commandName}`));
        return true;

    } catch (error) {
        console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO FATAL]`) + chalk.red(` checkStaffPermission: ${error.message}`));
        console.log(chalk.gray(error.stack));
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ERRO AO VERIFICAR PERMISSÃO`)
            .setDescription(`Ocorreu um erro ao verificar suas permissões.\n\`\`\`${error.message}\`\`\``)
            .setTimestamp();
        
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
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
                .setDescription('O bot não possui as permissões necessárias para executar esta ação.')
                .addFields(
                    { name: '🔧 Permissões Faltando', value: missingPerms.map(p => `\`${p}\``).join(', '), inline: false },
                    { name: '📌 Solução', value: 'Adicione as permissões mencionadas ao bot no servidor', inline: false }
                )
                .setFooter({ text: `${EMOJIS.BOT} Contate um administrador do servidor` })
                .setTimestamp();

            await interaction.reply({ embeds: [permEmbed], ephemeral: true });
            console.log(chalk.bgYellow.black(`${EMOJIS.STAFF_YELLOW}[PERMISSÃO]`) + chalk.yellow(` Bot sem permissões: ${missingPerms.join(', ')}`));
            return false;
        }

        return true;
    } catch (error) {
        console.log(chalk.red(`${EMOJIS.EMOJI_40}[ERRO] checkBotPermissionsForAction: ${error.message}`));
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
                .setDescription('Usuário não encontrado. Por favor, tente novamente.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        if (targetUser.bot) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} OPERAÇÃO INVÁLIDA`)
                .setDescription('Bots não podem receber ou possuir advertências.')
                .addFields({ name: '📌 Informação', value: 'O sistema de warns é apenas para usuários humanos.', inline: false })
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const warns = await warnManager.getUserWarns(targetUser.id);
        const warnCount = warns.length;
        const warnLevelColor = getWarnLevelColor(warnCount);
        const warnIcon = getWarnLevelIcon(warnCount);

        let member = null;
        let joinDate = null;
        let roles = [];
        try {
            member = await interaction.guild.members.fetch(targetUser.id);
            joinDate = member.joinedAt;
            roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).slice(0, 5);
        } catch (error) {
            console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[AVISO] Não foi possível buscar membro ${targetUser.id}: ${error.message}`));
        }

        if (warnCount === 0) {
            const cleanEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle(`${warnIcon} HISTÓRICO DE ADVERTÊNCIAS - LIMPO`)
                .setDescription(`O usuário **${targetUser.tag}** não possui nenhuma advertência registrada.`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: '👤 Usuário', value: `${targetUser.tag}`, inline: true },
                    { name: '🆔 ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: '⚠️ Total de Warns', value: '**0** - Histórico limpo', inline: true },
                    { name: '📊 Status', value: `${EMOJIS.EMOJI_43} Aprovado`, inline: true },
                    { name: '📅 Entrada no Servidor', value: joinDate ? `<t:${Math.floor(joinDate.getTime() / 1000)}:R>` : 'Não disponível', inline: true }
                )
                .setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação • Consulta por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [cleanEmbed], ephemeral: true });
            console.log(chalk.green(`${EMOJIS.EMOJI_43}[WARNSTATS] ${interaction.user.tag} consultou ${targetUser.tag} - 0 warns`));
            return;
        }

        let warnsList = '';
        let detailedInfo = '';

        for (let i = 0; i < warns.length; i++) {
            const warn = warns[i];
            const warnIconLevel = i === 0 ? EMOJIS.EMOJI_41 : (i === 1 ? EMOJIS.EMOJI_42 : EMOJIS.EMOJI_40);
            
            warnsList += `${warnIconLevel} **Warn #${warn.warnNumber}** - \`${warn.id}\`\n`;
            warnsList += `   📝 ${warn.reason}\n`;
            warnsList += `   📅 ${warn.formattedDate}\n`;
            warnsList += `   ${EMOJIS.STAFF} ${warn.staffName}\n`;
            
            if (detailed) {
                detailedInfo += `\`\`\`ansi\n[1;33m[WARN ${warn.warnNumber}][0m\n`;
                detailedInfo += `[32mID:[0m ${warn.id}\n`;
                detailedInfo += `[36mMotivo:[0m ${warn.reason}\n`;
                detailedInfo += `[35mData:[0m ${warn.formattedDate}\n`;
                detailedInfo += `[34mStaff:[0m ${warn.staffName}\n`;
                detailedInfo += `[33mTimestamp:[0m ${new Date(warn.date).getTime()}\n\`\`\`\n`;
            } else {
                if (i < warns.length - 1) warnsList += '\n';
            }
        }

        let statusMessage = '';
        let statusColor = '';
        if (warnCount === 1) {
            statusMessage = `${EMOJIS.EMOJI_41} ATENÇÃO - Primeira Advertência`;
            statusColor = '#F1C40F';
        } else if (warnCount === 2) {
            statusMessage = `${EMOJIS.EMOJI_42} CRÍTICO - Segunda Advertência`;
            statusColor = '#E67E22';
        } else {
            statusMessage = `${EMOJIS.EMOJI_40} MÁXIMO - Limite Atingido`;
            statusColor = '#E74C3C';
        }

        const statsEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle(`${warnIcon} HISTÓRICO DE ADVERTÊNCIAS`)
            .setDescription(`**Usuário:** ${targetUser.tag}\n**Total de Advertências:** ${warnCount}/3`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Usuário', value: `${targetUser.tag}`, inline: true },
                { name: '🆔 ID', value: `\`${targetUser.id}\``, inline: true },
                { name: '⚠️ Total de Warns', value: `**${warnCount}**/3`, inline: true },
                { name: '📊 Status Atual', value: statusMessage, inline: false },
                { name: '📋 ÚLTIMOS WARNS', value: warnsList.substring(0, 1024) || 'Nenhum warn detalhado', inline: false }
            );

        if (detailed && detailedInfo) {
            statsEmbed.addFields({ name: '📄 INFORMAÇÕES DETALHADAS', value: detailedInfo.substring(0, 1024), inline: false });
        }

        if (roles.length > 0) {
            statsEmbed.addFields({ name: '🎭 Cargos Principais', value: roles.join(', '), inline: false });
        }

        statsEmbed
            .setFooter({ text: `${EMOJIS.BOT} Consulta por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
        console.log(chalk.green(`${EMOJIS.EMOJI_43}[WARNSTATS] ${interaction.user.tag} consultou ${targetUser.tag} - ${warnCount} warns`));

    } catch (error) {
        console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO]`) + chalk.red(` handleWarnStats: ${error.message}`));
        console.log(chalk.gray(error.stack));
        await logManager.sendErrorLog('/warnstats', error, interaction.user, interaction);

        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ERRO AO CONSULTAR`)
            .setDescription('Ocorreu um erro ao buscar o histórico de advertências.')
            .addFields(
                { name: '🔧 Detalhes Técnicos', value: `\`\`\`${error.message.substring(0, 200)}\`\`\``, inline: false },
                { name: '📌 Sugestão', value: 'Tente novamente ou contate um administrador.', inline: false }
            )
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
                .setDescription('Usuário não encontrado. Verifique e tente novamente.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        if (targetUser.bot) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} OPERAÇÃO INVÁLIDA`)
                .setDescription('Não é possível adicionar advertências a bots.')
                .addFields(
                    { name: '🤖 Bots', value: 'Bots são automaticamente excluídos do sistema de warns.', inline: false },
                    { name: '📌 Motivo', value: 'Apenas usuários humanos podem receber advertências.', inline: false }
                )
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[ADDWARN] Tentativa de warn em bot ${targetUser.tag} por ${interaction.user.tag}`));
            return;
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} USUÁRIO NÃO ENCONTRADO`)
                .setDescription('O usuário não está mais no servidor ou não pôde ser encontrado.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        if (targetUser.id === interaction.user.id) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} AUTO-ADVERTÊNCIA`)
                .setDescription('Você não pode adicionar uma advertência a si mesmo.')
                .addFields({ name: '📌 Regra', value: 'Staff não pode aplicar warns em si mesmo.', inline: false })
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
                .setDescription(`Ocorreu um erro ao tentar adicionar a advertência.\n\`\`\`${result.error}\`\`\``)
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const warnCount = result.totalWarns;
        const warnId = result.warnId;

        const punishmentResults = await punishmentManager.processPunishments(member, warnCount, fullReason, warnId);

        const consequences = [];
        if (punishmentResults.rolesUpdated) consequences.push(`${EMOJIS.EMOJI_43} Cargos de warn atualizados`);
        if (punishmentResults.dmSent) consequences.push(`${EMOJIS.TICKET_TOOL} DM de aviso enviada`);
        if (punishmentResults.kicked) consequences.push(`${EMOJIS.EMOJI_40} Usuário expulso do servidor`);
        if (punishmentResults.errors.length > 0) consequences.push(...punishmentResults.errors.map(e => `${EMOJIS.EMOJI_40} ${e}`));

        let embedColor;
        let embedTitle;
        let embedDescription;
        let actionMessage = '';

        if (warnCount === 1) {
            embedColor = '#F1C40F';
            embedTitle = `${EMOJIS.EMOJI_41} ADVERTÊNCIA REGISTRADA - NÍVEL 1`;
            embedDescription = `Uma advertência foi adicionada ao usuário **${targetUser.tag}**`;
            actionMessage = 'O usuário recebeu o cargo de advertência nível 1.';
        } else if (warnCount === 2) {
            embedColor = '#E67E22';
            embedTitle = `${EMOJIS.EMOJI_42} SEGUNDA ADVERTÊNCIA - NÍVEL 2`;
            embedDescription = `Uma segunda advertência foi registrada para **${targetUser.tag}**`;
            actionMessage = '• Uma mensagem de aviso foi enviada via DM\n• Cargos de advertência foram atualizados\n• Próxima advertência resultará em expulsão';
        } else {
            embedColor = '#E74C3C';
            embedTitle = `${EMOJIS.EMOJI_40} LIMITE MÁXIMO ATINGIDO - EXPULSÃO`;
            embedDescription = `**${targetUser.tag}** atingiu o limite máximo de 3 advertências`;
            actionMessage = '• O usuário foi **EXPULSO** do servidor\n• Uma mensagem de notificação foi enviada\n• Todos os cargos de warn foram removidos';
        }

        const responseEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Usuário', value: `${targetUser.tag}\n(${targetUser.id})`, inline: true },
                { name: `${EMOJIS.STAFF} Staff Responsável`, value: `${interaction.user.tag}\n(${interaction.user.id})`, inline: true },
                { name: `${EMOJIS.TICKET_TOOL} ID do Warn`, value: `\`${warnId}\``, inline: true },
                { name: '⚠️ Total de Warns', value: `${warnCount}/3`, inline: true },
                { name: '📝 Motivo', value: fullReason.length > 100 ? fullReason.substring(0, 100) + '...' : fullReason, inline: false },
                { name: '⚡ Ações Aplicadas', value: actionMessage, inline: false }
            )
            .setFooter({ text: `${EMOJIS.BOT} Sistema de Moderação • ${formatDateBrazilian(new Date())}`, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [responseEmbed], ephemeral: true });

        await logManager.sendModerationLog(targetUser, interaction.user, 'ADDWARN', {
            warnId: warnId,
            warnCount: warnCount,
            reason: fullReason,
            consequences: consequences,
            errors: punishmentResults.errors
        });

        console.log(chalk.bgGreen.black(`${EMOJIS.EMOJI_43}[ADDWARN] ${interaction.user.tag} deu warn em ${targetUser.tag} - Total: ${warnCount}/3`));

    } catch (error) {
        console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO FATAL]`) + chalk.red(` handleAddWarn: ${error.message}`));
        console.log(chalk.gray(error.stack));
        await logManager.sendErrorLog('/addwarn', error, interaction.user, interaction);

        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ERRO CRÍTICO`)
            .setDescription('Ocorreu um erro inesperado ao processar o comando.')
            .addFields(
                { name: '🔧 Detalhes', value: `\`\`\`${error.message.substring(0, 300)}\`\`\``, inline: false },
                { name: '📌 Ação', value: 'Contate um administrador e tente novamente.', inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// ============================================
// HANDLER DO COMANDO /removewarn
// ============================================

async function handleRemoveWarn(interaction) {
    try {
        const hasStaffPermission = await checkStaffPermission(interaction);
        if (!hasStaffPermission) return;

        const botHasPerms = await checkBotPermissionsForAction(interaction, 'removewarn');
        if (!botHasPerms) return;

        const targetUser = interaction.options.getUser('usuario');
        const warnId = interaction.options.getString('id');
        const removalReason = interaction.options.getString('motivo') || 'Não especificado';

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
                .setDescription('Bots não possuem advertências para remover.')
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const currentWarns = await warnManager.getUserWarns(targetUser.id);
        if (currentWarns.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} NENHUM WARN ENCONTRADO`)
                .setDescription(`O usuário **${targetUser.tag}** não possui nenhuma advertência registrada.`)
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const result = await warnManager.removeWarn(targetUser.id, warnId, interaction.user.id, interaction.user.tag);

        if (!result.success) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`${EMOJIS.EMOJI_40} FALHA AO REMOVER WARN`)
                .setDescription(`Não foi possível remover a advertência.\n\`\`\`${result.error}\`\`\``)
                .addFields(
                    { name: '🆔 ID Buscado', value: `\`${warnId}\``, inline: true },
                    { name: '📌 Dica', value: 'Verifique se o ID está correto', inline: false }
                )
                .setTimestamp();
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return;
        }

        const newWarnCount = result.totalWarns;
        const removedWarn = result.removedWarn;

        let roleUpdateResult = { success: true, errors: [] };
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (member) {
            roleUpdateResult = await punishmentManager.applyWarnRole(member, newWarnCount);
        }

        let embedColor;
        let statusMessage;

        if (newWarnCount === 0) {
            embedColor = '#2ECC71';
            statusMessage = `${EMOJIS.EMOJI_43} Histórico completamente limpo - Sem advertências`;
        } else if (newWarnCount === 1) {
            embedColor = '#F1C40F';
            statusMessage = `${EMOJIS.EMOJI_41} Nível 1 - Atenção moderada`;
        } else if (newWarnCount === 2) {
            embedColor = '#E67E22';
            statusMessage = `${EMOJIS.EMOJI_42} Nível 2 - Situação crítica`;
        } else {
            embedColor = '#E74C3C';
            statusMessage = `${EMOJIS.EMOJI_40} Nível 3 - Limite máximo`;
        }

        const responseEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${EMOJIS.EMOJI_43} ADVERTÊNCIA REMOVIDA`)
            .setDescription(`Uma advertência foi removida do histórico de **${targetUser.tag}**`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Usuário', value: `${targetUser.tag}\n(${targetUser.id})`, inline: true },
                { name: `${EMOJIS.STAFF} Staff Responsável`, value: `${interaction.user.tag}\n(${interaction.user.id})`, inline: true },
                { name: `${EMOJIS.TICKET_TOOL} Warn Removido`, value: `\`${removedWarn.id}\``, inline: true },
                { name: '📝 Motivo Original', value: removedWarn.reason.length > 100 ? removedWarn.reason.substring(0, 100) + '...' : removedWarn.reason, inline: false },
                { name: '📌 Motivo da Remoção', value: removalReason, inline: false },
                { name: '⚠️ Warns Restantes', value: `${newWarnCount}/3`, inline: true },
                { name: '📊 Status Atual', value: statusMessage, inline: true }
            )
            .setFooter({ text: `${EMOJIS.BOT} Remoção registrada em ${formatDateBrazilian(new Date())}`, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        if (!roleUpdateResult.success) {
            responseEmbed.addFields({ name: `${EMOJIS.EMOJI_42} Alerta de Cargos`, value: `Não foi possível atualizar os cargos: ${roleUpdateResult.error}`, inline: false });
        }

        await interaction.reply({ embeds: [responseEmbed], ephemeral: true });

        await logManager.sendModerationLog(targetUser, interaction.user, 'REMOVEWARN', {
            warnId: removedWarn.id,
            warnCount: newWarnCount,
            originalReason: removedWarn.reason,
            removalReason: removalReason,
            consequences: [`Warn ${removedWarn.id} removido do histórico`, `Total de warns agora: ${newWarnCount}/3`]
        });

        console.log(chalk.bgYellow.black(`${EMOJIS.EMOJI_42}[REMOVEWARN] ${interaction.user.tag} removeu warn ${warnId} de ${targetUser.tag} - Restam: ${newWarnCount}`));

    } catch (error) {
        console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO FATAL]`) + chalk.red(` handleRemoveWarn: ${error.message}`));
        console.log(chalk.gray(error.stack));
        await logManager.sendErrorLog('/removewarn', error, interaction.user, interaction);

        const errorEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${EMOJIS.EMOJI_40} ERRO AO REMOVER`)
            .setDescription(`\`\`\`${error.message.substring(0, 300)}\`\`\``)
            .setTimestamp();
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

// ============================================
// HANDLER PRINCIPAL DE INTERAÇÕES
// ============================================

async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    console.log(chalk.cyan(`${EMOJIS.GIT}[COMANDO] ${interaction.user.tag} executou /${interaction.commandName}`));

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
            console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[AVISO] Comando desconhecido: ${interaction.commandName}`));
    }
}

// ============================================
// REGISTRO DE COMANDOS GLOBAIS
// ============================================

async function registerGlobalCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        
        console.log(chalk.blue(`${EMOJIS.GIT}[REGISTRO]`) + ' Iniciando registro de comandos slash globais...');
        console.log(chalk.gray(`├─ Total de comandos: ${commands.length}`));
        console.log(chalk.gray(`├─ Cliente ID: ${CLIENT_ID}`));
        console.log(chalk.gray(`└─ Tipo: Global (todos servidores)`));

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );

        console.log(chalk.green(`${EMOJIS.EMOJI_43}[SUCESSO]`) + ' Comandos slash registrados globalmente com sucesso!');
        console.log(chalk.gray('   Os comandos estarão disponíveis em alguns minutos para todos os servidores.'));
    } catch (error) {
        console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO REGISTRO]`) + chalk.red(` Falha ao registrar comandos: ${error.message}`));
        console.log(chalk.gray(error.stack));
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
    console.log(chalk.bgGreen.black('\n═══════════════════════════════════════════════════'));
    console.log(chalk.bgGreen.black('            BOT INICIADO COM SUCESSO                 '));
    console.log(chalk.bgGreen.black('═══════════════════════════════════════════════════\n'));
    
    console.log(chalk.green(`${EMOJIS.BOT}[BOT] Logado como: ${chalk.bold(client.user.tag)}`));
    console.log(chalk.green(`${EMOJIS.BOT}[BOT] ID: ${chalk.gray(client.user.id)}`));
    console.log(chalk.green(`${EMOJIS.BOT}[BOT] Servidores: ${chalk.bold(client.guilds.cache.size)}`));
    console.log(chalk.green(`${EMOJIS.BOT}[BOT] Usuários totais: ${chalk.bold(client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0))}`));
    
    console.log(chalk.cyan('\n[CONFIGURAÇÃO]'));
    console.log(chalk.gray(`├─ ${EMOJIS.STAFF} STAFF_ROLE_ID: ${STAFF_ROLE_ID && STAFF_ROLE_ID !== 'id_do_cargo_staff' ? '✓ Configurado' : '✗ Não configurado'}`));
    console.log(chalk.gray(`├─ ${EMOJIS.EMOJI_41} WARN_1: ${WARN_1 && WARN_1 !== 'id_do_cargo_warn_1' ? '✓ Configurado' : '✗ Não configurado'}`));
    console.log(chalk.gray(`├─ ${EMOJIS.EMOJI_42} WARN_2: ${WARN_2 && WARN_2 !== 'id_do_cargo_warn_2' ? '✓ Configurado' : '✗ Não configurado'}`));
    console.log(chalk.gray(`├─ ${EMOJIS.EMOJI_40} WARN_3: ${WARN_3 && WARN_3 !== 'id_do_cargo_warn_3' ? '✓ Configurado' : '✗ Não configurado'}`));
    console.log(chalk.gray(`└─ ${EMOJIS.TICKET_TOOL} LOG_CHANNEL_ID: ${LOG_CHANNEL_ID && LOG_CHANNEL_ID !== 'id_do_canal_de_logs' ? '✓ Configurado' : '✗ Não configurado'}`));
    
    loadWarnsDatabase();
    await registerGlobalCommands();
    
    for (const guild of client.guilds.cache.values()) {
        await punishmentManager.checkBotPermissions(guild);
    }
    
    client.user.setPresence({
        activities: [{
            name: `${commands.length} comandos | /warnstats`,
            type: 3
        }],
        status: 'online'
    });
    
    console.log(chalk.green(`\n${EMOJIS.EMOJI_43}[STATUS] Bot pronto e aguardando comandos!\n`));
});

client.on('interactionCreate', handleInteraction);

client.on('guildMemberAdd', async (member) => {
    const warns = await warnManager.getUserWarns(member.id);
    if (warns.length > 0) {
        await punishmentManager.applyWarnRole(member, warns.length);
        console.log(chalk.cyan(`${EMOJIS.GIT}[RECONEXÃO] ${member.user.tag} reconectou com ${warns.length} warns - Cargos restaurados`));
    }
});

client.on('error', (error) => {
    console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[CLIENTE ERRO]`) + chalk.red(` ${error.message}`));
});

client.on('rateLimit', (rateLimitInfo) => {
    console.log(chalk.yellow(`${EMOJIS.EMOJI_42}[RATE LIMIT] Timeout: ${rateLimitInfo.timeout}, Rota: ${rateLimitInfo.route}`));
});

// ============================================
// BACKUP AUTOMÁTICO
// ============================================

setInterval(() => {
    saveWarnsDatabase();
}, 300000);

setInterval(async () => {
    const stats = {
        totalUsers: warnsDatabase.size,
        totalWarns: 0
    };
    for (const warns of warnsDatabase.values()) {
        stats.totalWarns += warns.length;
    }
    console.log(chalk.gray(`${EMOJIS.GIT}[STATS] ${new Date().toLocaleTimeString()} - ${stats.totalUsers} usuários | ${stats.totalWarns} warns totais`));
}, 3600000);

// ============================================
// TRATAMENTO DE SINAIS DO SISTEMA
// ============================================

process.on('SIGINT', () => {
    console.log(chalk.yellow(`\n${EMOJIS.EMOJI_42}[SHUTDOWN] Salvando dados antes de encerrar...`));
    saveWarnsDatabase();
    console.log(chalk.green(`${EMOJIS.EMOJI_43}[SHUTDOWN] Dados salvos. Encerrando bot...`));
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[UNCAUGHT EXCEPTION]`));
    console.log(chalk.red(` Mensagem: ${error.message}`));
    console.log(chalk.gray(error.stack));
    saveWarnsDatabase();
});

process.on('unhandledRejection', (reason, promise) => {
    console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[UNHANDLED REJECTION]`));
    console.log(chalk.red(` Razão: ${reason}`));
    saveWarnsDatabase();
});

// ============================================
// INICIALIZAÇÃO DO BOT
// ============================================

console.log(chalk.blue(`\n${EMOJIS.GIT}[INICIANDO] Carregando bot...\n`));

client.login(TOKEN).catch(error => {
    console.log(chalk.bgRed.white(`${EMOJIS.EMOJI_40}[ERRO FATAL]`) + chalk.red(` Não foi possível fazer login: ${error.message}`));
    console.log(chalk.gray('Verifique seu TOKEN no arquivo .env'));
    process.exit(1);
});

// ============================================
// FIM DO CÓDIGO
// ============================================
