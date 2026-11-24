# Automata Studio

Simulador **moderno e interativo** de autômatos para estudar Linguagens Formais e Autômatos:
**autômatos finitos** (AFD, AFN e ε-AFN), **autômatos com pilha** (AP) e **máquinas de Turing** (MT),
no modelo e na notação do livro do **Hopcroft**. Ele mostra **o que acontece** em cada passo: a
simulação anima os estados, a pilha e a fita; as descrições instantâneas saem como no livro; a tabela
de minimização é preenchida rodada por rodada e o AFN → AFD mostra a conta de cada subconjunto.

Baseado no **YAAS** (*Yet Another Automata Simulator*), do Prof. Dr. David Buzatto (IFSP),
distribuído sob a GPL v3. Os algoritmos foram reescritos em TypeScript e conferidos contra o YAAS
original (veja *Testes*).

## O que dá para fazer

- **Criar:** o **+** das abas (ou **Alt+N**) abre um autômato novo: **AF**, **AP** ou **MT**. A aba
  mostra o tipo.
- **Desenhar:**
  - duplo clique cria um estado;
  - arrastar da borda de um estado até outro cria uma transição;
  - o **botão ε** (ou **Ctrl+E**) insere a palavra vazia;
  - clique direito marca o estado como inicial ou final;
  - arrastar o rótulo de uma seta curva a seta;
  - Desfazer e Refazer, abas, tema claro e escuro.
- **Simular:** digite a palavra e aperte Enter. No fim aparece **ACEITA** ou **REJEITA**, com o motivo.
  A aba **Teste em lote** testa várias palavras de uma vez (e o botão **Do exemplo** traz as palavras
  de teste dos exemplos).
- **Painel lateral:** tipo do autômato, definição formal e tabela de transição no estilo do Hopcroft
  (→ no inicial, * nos finais). A regra usada no passo atual acende.
- **Exemplos:** os exemplos do YAAS (24 AF, 14 AP e 8 MT), com miniatura.
- **Arquivos:** salvar e abrir `.automato.json`; exportar PNG e SVG.

### Autômatos finitos

- A palavra aparece como uma fita, os estados ativos acendem e cada passo mostra `δ(…)` e `ECLOSE(…)`.
- **Algoritmos** (o resultado abre numa aba nova): AFN → AFD (tabela de subconjuntos); minimização
  (método da tabela, passo a passo); completar com estado morto; complemento; remover inalcançáveis ou
  inúteis; união, concatenação, interseção e fecho de Kleene; comparar equivalência (mostra a menor
  palavra que diferencia os autômatos).

### Autômatos com pilha — P = (Q, Σ, Γ, δ, q₀, Z₀, F)

- Cada regra é `a, X/γ`, como no livro: lê `a` (ou ε), **desempilha X** e empilha γ (o 1º símbolo de
  γ fica no topo). Na janela de regras dá para escrever várias de uma vez, no formato `0, Z / 0Z`.
- O quadro no canto do canvas muda o **Z₀** (padrão `Z`) e o modo de aceitação: **por estado final**
  (L(P)) ou **por pilha vazia** (N(P)).
- A simulação mostra a **pilha** (topo em cima) empilhando e desempilhando, e as descrições
  instantâneas `(q, w, γ)` ligadas por `⊢`.
- A aba **Árvore de IDs** mostra a busca inteira do AP não determinístico: os ramos que aceitam,
  morrem ou se repetem.
- **Algoritmos:** pilha vazia → estado final (Teorema 6.9) e estado final → pilha vazia (Teorema 6.11).

### Máquinas de Turing — M = (Q, Σ, Γ, δ, q₀, B, F)

- Cada regra é `X/Y →` ou `X/Y ←` (na janela de regras também vale escrever `0/X R`).
- O quadro no canto do canvas muda o **branco** (padrão `B`), o **Σ** e o modo de aceitação: **por
  estado final** (aceita ao entrar num final) ou **por parada** (para MT que calcula uma função: a
  **saída** é o que ficou na fita).
- A simulação mostra a **fita infinita** com a cabeça e as descrições instantâneas como no livro
  (`XXq1Y1`). Exemplo 8.2 com `0011`: `q00011 ⊢ Xq1011 ⊢ … ⊢ XXYYBq4B`.
- Quando a MT repete uma configuração, o resultado é **NÃO PARA**. Quando passa do limite de passos
  sem decidir, é **INDEFINIDO**, com o botão **Continuar**.
- **MT não determinística:** a simulação faz uma busca em largura e mostra a árvore de IDs.

### Atalhos

| Tecla | O quê |
|---|---|
| `Alt+N` | novo autômato (AF, AP ou MT) |
| `S` / `V` | ferramenta Estado / Selecionar |
| `I` / `F` | marcar o estado selecionado como inicial / final |
| `Delete` | apagar a seleção |
| `Ctrl+Z` / `Ctrl+Y` | desfazer / refazer |
| `Ctrl+S` / `Ctrl+O` | salvar / abrir |
| `Espaço`, `←` / `→` | tocar/pausar e andar na simulação |

## Como rodar

**No navegador** (para desenvolver):
```bash
npm ci
npm run dev        # http://localhost:5173
```

**Como programa de computador** (Linux Mint/Ubuntu):
```bash
sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
                 librsvg2-dev libxdo-dev libayatana-appindicator3-dev   # só na 1ª vez
npm ci
npm run tauri build
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```
Depois disso, o **Automata Studio** aparece no menu de aplicativos.

### No Windows (10 ou 11)

Há dois jeitos: **no navegador** (mais rápido, só precisa do Node.js) ou **como programa
instalado** (gera um instalador `.exe`, mas precisa de mais ferramentas).

#### 1. Baixar o projeto

- **Com Git:** abra o **PowerShell** e rode
  ```powershell
  git clone https://github.com/matheusufurlan-hash/automata-studio.git
  cd automata-studio
  ```
- **Sem Git:** nesta página, clique em **Code → Download ZIP**, extraia a pasta, abra a pasta
  extraída no Explorador de Arquivos, clique na barra de endereço, digite `powershell` e aperte
  Enter. O PowerShell abre já dentro da pasta.

#### 2. Instalar o Node.js

Baixe a versão **LTS** em [nodejs.org](https://nodejs.org) (precisa ser a 20.19 ou mais nova) e
instale com as opções padrão. **Feche e abra o PowerShell de novo** e confira:
```powershell
node -v
```

> Se o PowerShell disser que *a execução de scripts foi desabilitada* ao rodar `npm`, rode uma vez
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e confirme com **S**.

#### 3a. Rodar no navegador

Dentro da pasta do projeto:
```powershell
npm ci
npm run dev
```
Abra **http://localhost:5173** no navegador. Para parar, aperte **Ctrl+C** no PowerShell. Da
próxima vez, basta o `npm run dev`.

#### 3b. Gerar o programa instalável (.exe)

Instale, só na 1ª vez:
1. **Microsoft C++ Build Tools:** baixe em
   [visualstudio.microsoft.com/visual-cpp-build-tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/),
   abra o instalador e marque **"Desenvolvimento para desktop com C++"**.
2. **Rust:** baixe e rode o `rustup-init.exe` de [rustup.rs](https://rustup.rs) e aceite a opção
   padrão (Enter).
3. **WebView2:** já vem no Windows 10 (atualizado) e no Windows 11. Se faltar, baixe o
   *Evergreen Bootstrapper* em
   [developer.microsoft.com/microsoft-edge/webview2](https://developer.microsoft.com/microsoft-edge/webview2/).

Feche e abra o PowerShell de novo, entre na pasta do projeto e rode:
```powershell
npm ci
npm run tauri build -- --bundles nsis
```
A 1ª compilação demora (vários minutos). O instalador fica em
`src-tauri\target\release\bundle\nsis\`, com um nome parecido com
`Automata Studio_0.2.0_x64-setup.exe`. Dê dois cliques nele. Depois, o **Automata Studio** aparece
no Menu Iniciar.

> Se o Windows mostrar **"O Windows protegeu o computador"**, clique em **Mais informações →
> Executar assim mesmo**. O aviso aparece porque o instalador não tem assinatura digital.

## Testes

```bash
npm test            # 2 300+ testes (Vitest)
npm run typecheck && npm run lint
```

- **Oráculos:** `tools/oraculo/GerarOraculo.java`, `GerarOraculoAP.java` e `GerarOraculoMT.java`
  rodam o YAAS original (`YAAS-1.0.7.jar`) nos exemplos e gravam as respostas em
  `src/core/*/__fixtures__/oraculo.json`. Os testes conferem que o nosso núcleo aceita as **mesmas
  palavras** (e, no AF, dá o **mesmo número de estados**). Onde o YAAS erra, a diferença está
  explicada no próprio teste.
- **Testes de propriedade:** centenas de AF, AP e MT aleatórios conferidos contra simulações
  ingênuas escritas à parte.

Diferenças e bugs do YAAS 1.0.7 encontrados durante o trabalho (não foram copiados):
- **AP:** o YAAS usa operações prontas (empilhar, desempilhar, trocar o topo) e um "topo ε" que só
  vale com a pilha vazia; aqui o AP segue o Hopcroft (`a, X/γ`). Os exemplos foram traduzidos.
- **Máquina de Turing:**
  - aplica duas operações seguidas quando uma transição tem várias (aqui: uma regra por passo);
  - o limite fixo de 4000 passos marca MTs longas como "não para" (aqui: limite ajustável, e o
    programa diferencia "não para" de "ainda não decidiu");
  - não simula MT não determinística: segue sempre a 1ª regra (aqui: busca em largura).
- **União:** marca um 2º estado inicial, e simular o resultado dá erro.
- **Interseção:** usa a união por dentro e erra quando os alfabetos são diferentes.

## Como o projeto está organizado

Feito em duas etapas: primeiro os autômatos finitos (v0.1), depois AP e MT (v0.2).

| Pasta | O quê |
|---|---|
| `src/core/fa/`, `src/core/pda/`, `src/core/tm/` | núcleos: algoritmos puros, sem nada de tela |
| `src/ui/editor/`, `src/store/`, `src/layout/` | editor visual, documentos, Desfazer/Refazer |
| `src/ui/simulacao/`, `src/ui/ferramentas/` | simulação, algoritmos, tabelas |
| `src/platform/` | arquivos (navegador e desktop) |
| `src-tauri/` | casca do programa de computador (Tauri 2) |

**Tecnologias:** TypeScript, React, @xyflow/react (React Flow), Zustand, Tailwind CSS, Vitest e Tauri 2.

## Licença

GPL v3 (veja [`LICENSE`](LICENSE)), a mesma do YAAS, do qual este projeto deriva.
Créditos dos algoritmos e exemplos originais: **Prof. Dr. David Buzatto**.
