const API_URL = 'https://script.google.com/macros/s/AKfycbwzMmvwO0RPr3wT-R9ZgYgaVC-3Yb_u9_i1GETR7AxEeRzJYo73D7KgmXQ99eh0vzA5Nw/exec';

class PhantomEngine {
    constructor() {
        this.currentUser = null;
        this.currentGroup = null;
        this.lastSync = 0;
        this.syncInterval = null;
        this.MESSAGE_LIFESPAN = 12000; // 12 segundos até sumir
    }

    async request(action, payload) {
        payload.action = action;
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return data.data;
    }

    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    async register() {
        const name = document.getElementById('username').value;
        const emoji = document.getElementById('emoji').value;
        if (!name || !emoji) return alert('Preencha os campos.');
        this.currentUser = await this.request('registerUser', { name, emoji });
        this.loadGroups();
    }

    async loadGroups() {
        this.switchScreen('groups-screen');
        const groups = await this.request('getGroups', { userId: this.currentUser.id });
        const list = document.getElementById('groups-list');
        list.innerHTML = '';
        groups.forEach(g => {
            const li = document.createElement('li');
            li.innerText = g.name;
            li.style.cursor = 'pointer';
            li.style.padding = '10px';
            li.style.borderBottom = '1px solid #333';
            li.onclick = () => this.openChat(g);
            list.appendChild(li);
        });
    }

    async showNewGroupScreen() {
        this.switchScreen('create-group-screen');
        const users = await this.request('getUsers', {});
        const container = document.getElementById('users-selection');
        container.innerHTML = '';
        users.forEach(u => {
            if (u.id === this.currentUser.id) return;
            const label = document.createElement('label');
            label.style.display = 'block';
            label.innerHTML = `<input type="checkbox" value="${u.id}"> ${u.emoji} ${u.name}`;
            container.appendChild(label);
        });
    }

    async createGroup() {
        const name = document.getElementById('group-name').value;
        const checkboxes = document.querySelectorAll('#users-selection input:checked');
        const members = Array.from(checkboxes).map(c => c.value);
        members.push(this.currentUser.id); // Adiciona a si mesmo
        await this.request('createGroup', { name, members });
        this.loadGroups();
    }

    backToGroups() {
        clearInterval(this.syncInterval);
        this.loadGroups();
    }

    openChat(group) {
        this.currentGroup = group;
        this.lastSync = 0;
        document.getElementById('current-group-name').innerText = group.name;
        document.getElementById('messages-container').innerHTML = '';
        this.switchScreen('chat-screen');
        
        // Polling para novas mensagens a cada 3 segundos
        this.syncInterval = setInterval(() => this.syncMessages(), 3000);
    }

    async syncMessages() {
        if(!this.currentGroup) return;
        const messages = await this.request('syncMessages', { 
            groupId: this.currentGroup.id, 
            lastTimestamp: this.lastSync 
        });

        messages.forEach(msg => {
            this.renderMessage(msg);
            this.lastSync = Math.max(this.lastSync, msg.timestamp);
        });
    }

    async sendTextMessage() {
        const input = document.getElementById('msg-input');
        const content = input.value;
        if (!content) return;
        input.value = '';
        await this.request('sendMessage', { 
            groupId: this.currentGroup.id, 
            senderId: this.currentUser.id, 
            content: content, 
            type: 'text' 
        });
        this.syncMessages();
    }

    async handleImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            await this.request('sendMessage', { 
                groupId: this.currentGroup.id, 
                senderId: this.currentUser.id, 
                content: base64, 
                type: 'image' 
            });
            this.syncMessages();
        };
        reader.readAsDataURL(file);
    }

    renderMessage(msg) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `msg ${msg.senderId === this.currentUser.id ? 'sent' : 'received'}`;
        
        if (msg.type === 'text') {
            div.innerText = msg.content;
        } else if (msg.type === 'image') {
            div.innerHTML = `<img src="${msg.content}" alt="Phantom Image">`;
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        // O SEGREDO DO APP: Destruição do elemento na interface após X segundos
        setTimeout(() => {
            div.classList.add('fade-out');
            setTimeout(() => div.remove(), 2000); // Aguarda a transição CSS antes de remover do DOM
        }, this.MESSAGE_LIFESPAN);
    }
}

const PhantomApp = new PhantomEngine();
