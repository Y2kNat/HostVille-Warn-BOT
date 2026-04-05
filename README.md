<p align="center">
  <img src="https://cdn.discordapp.com/attachments/1481730240236752906/1490186146557202542/2caafef3b98fb7ca780403088149bce9.png?ex=69d3237f&is=69d1d1ff&hm=325cab5741420b06e38c8860feac3aa9699d1a89271f44e94d68998535a63f5a&" alt="Warn Bot Banner" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-5.0.1-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/node-16.9%2B-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/discord.js-v14.14.0-blue.svg" alt="Discord.js">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/status-online-brightgreen.svg" alt="Status">
  <img src="https://img.shields.io/badge/warns%20system-v2.0.0-orange.svg" alt="Warns System">
</p>

# 🛡️ Warn System Bot - Sistema Completo de Moderação

**Versão 1.0.0** - Bot de moderação avançado para Discord com sistema completo de warns, punições automáticas e logs de staff.

---

## 📋 Sobre o Projeto

O **Warn System Bot** é um sistema de moderação robusto desenvolvido em **Node.js** com **discord.js v14**, focado em controle de advertências (warns) e automação de punições dentro de servidores Discord.

Ele foi projetado para substituir sistemas manuais de moderação, trazendo automação, organização e segurança.

---

## 🚀 Funcionalidades Principais

<table>
  <tr>
    <td align="center" width="33%">
      ⚠️ <br>
      <strong>Sistema de Warns</strong>
      <br>
      <sub>Banco de dados local com histórico completo de advertências</sub>
    </td>
    <td align="center" width="33%">
      🛡️ <br>
      <strong>Punições Automáticas</strong>
      <br>
      <sub>Aplicação automática de cargos e expulsão no limite</sub>
    </td>
    <td align="center" width="33%">
      📜 <br>
      <strong>Sistema de Logs</strong>
      <br>
      <sub>Registro completo de ações de staff em canal dedicado</sub>
    </td>
  </tr>

  <tr>
    <td align="center">
      📩 <br>
      <strong>DM Automática</strong>
      <br>
      <sub>Notificação automática para usuários punidos</sub>
    </td>
    <td align="center">
      👮 <br>
      <strong>Controle de Staff</strong>
      <br>
      <sub>Permissões baseadas em cargos configuráveis</sub>
    </td>
    <td align="center">
      💾 <br>
      <strong>Persistência de Dados</strong>
      <br>
      <sub>Armazenamento em JSON com backup automático</sub>
    </td>
  </tr>
</table>

---

## ⚙️ Sistema de Punições

O bot funciona com base em níveis de advertência:

| Nível | Ação |
|------|------|
| 1 Warn | Aplicação de cargo WARN_1 |
| 2 Warns | Cargo WARN_2 + aviso por DM |
| 3 Warns | Cargo WARN_3 + expulsão automática |

---

## 🧠 Comandos Disponíveis

### `/warnstats`
Exibe o histórico completo de advertências de um usuário.

- 📊 Total de warns
- 📝 Lista detalhada
- 🎯 Status atual

---

### `/addwarn`
Adiciona uma advertência a um usuário.

**Funções:**
- Registro de motivo
- ID único do warn
- Aplicação automática de punições
- Log em canal de staff

---

### `/removewarn`
Remove a última advertência de um usuário.

**Funções:**
- Atualiza histórico
- Recalcula nível
- Remove cargos se necessário
- Registra no log

---

## 🔐 Sistema de Permissões

### 👮 Staff Roles
Somente usuários com os cargos configurados podem usar comandos.
