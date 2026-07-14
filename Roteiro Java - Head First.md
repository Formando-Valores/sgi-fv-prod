# Roteiro de Estudo Java - Use a Cabeça Java (Head First Java)

**Livro:** Use a Cabeça Java (Head First Java) - 2ª/3ª Edição
**Autores:** Kathy Sierra, Bert Bates
**Objetivo:** Domínio completo de Java a partir do zero até níveis avançados
**Metodologia:** Estudo ativo - cada aula inclui teoria, código prático e exercícios

---

## Como Usar Este Roteiro

- **Cada aula** cobre um capítulo do livro com resumo, conceitos-chave, código prático e exercícios
- **Progresso** é registrado abaixo. Atualize sempre que concluir uma aula
- **Não pule aulas** - cada conceito é base para o próximo
- **Execute todo código** - digite, não copie e cole
- **Revise o MD** no início de cada sessão para retomar de onde parou

---

## Status do Progresso

| Aula | Capítulo | Tópico Principal | Status | Data |
|:----:|:--------:|:-----------------|:------:|:----:|
| 01 | Cap 1 | Java Basics - Compilar e Rodar | ⬜ Pendente | - |
| 02 | Cap 2 | Classes e Objetos | ⬜ Pendente | - |
| 03 | Cap 3 | Variáveis - Primitivos e Referências | ⬜ Pendente | - |
| 04 | Cap 4 | Métodos e Comportamento de Objetos | ⬜ Pendente | - |
| 05 | Cap 5 | Fluxo de Controle (if/for/while) | ⬜ Pendente | - |
| 06 | Cap 6 | Biblioteca Java (ArrayList, API) | ⬜ Pendente | - |
| 07 | Cap 7 | Herança e Polimorfismo | ⬜ Pendente | - |
| 08 | Cap 8 | Interfaces e Classes Abstratas | ⬜ Pendente | - |
| 09 | Cap 9 | Construtores e Gerenciamento de Memória | ⬜ Pendente | - |
| 10 | Cap 10 | Números, Math e Static | ⬜ Pendente | - |
| 11 | Cap 11 | Tratamento de Exceções | ⬜ Pendente | - |
| 12 | Cap 12 | Collections e Generics | ⬜ Pendente | - |
| 13 | Cap 13 | Streams e Lambda (3ª Ed) | ⬜ Pendente | - |
| 14 | Cap 14 | GUI - Swing e Eventos | ⬜ Pendente | - |
| 15 | Cap 15 | Swing - Layout e Componentes | ⬜ Pendente | - |
| 16 | Cap 16 | Serialização e I/O | ⬜ Pendente | - |
| 17 | Cap 17 | Networking - Sockets | ⬜ Pendente | - |
| 18 | Cap 18 | Multithreading | ⬜ Pendente | - |

---

## Aula 01 - Java Basics: Compilar e Rodar (Capítulo 1)

**Livrinho:** Use a Cabeça Java, Capítulo 1 - "Quebrando o Gelo"

### O que é Java?
- Linguagem **Orientada a Objetos** (tudo vive dentro de uma classe)
- **Write Once, Run Anywhere** (escreva uma vez, execute em qualquer lugar)
- Código-fonte → Compilador (`javac`) → Bytecode → JVM executa

### Como Funciona a Execução
```
SeuCódigo.java  --javac-->  SeuCódigo.class (bytecode)  --java-->  JVM executa
```

### Estrutura Básica de um Programa Java
```java
public class MeuPrograma {
    public static void main(String[] args) {
        System.out.println("Olá, Java!");
    }
}
```

### Conceitos-Chave
- **Classe:** Um arquivo `.java` que contém o código. O nome do arquivo DEVE ser igual ao nome da classe pública
- **`main()` Método:** Ponto de entrada. O JVM procura `public static void main(String[] args)`
- **`System.out.println()`:** Imprime texto na tela
- **`public`, `static`, `void`:** Modificadores. Não se preocupe em entender tudo agora, apenas use

### Regras Fundamentais
1. Todo código Java vive dentro de uma **classe**
2. Uma classe pode ter vários **métodos**
3. Um método contém **instruções** (statements)
4. Java é **case-sensitive** (`MeuPrograma` ≠ `meuPrograma`)
5. Toda instrução termina com **ponto e vírgula** (`;`)

### Tipos de Dados Básicos (Primitivos)
| Tipo | O que guarda | Tamanho |
|------|-------------|---------|
| `int` | Números inteiros | 32 bits |
| `double` | Números decimais | 64 bits |
| `boolean` | `true` ou `false` | 1 bit |
| `char` | Um caractere (entre aspas simples) | 16 bits |

### Operadores Aritméticos
```java
int x = 10 + 3;    // 13 (soma)
int y = 10 - 3;    // 7  (subtração)
int z = 10 * 3;    // 30 (multiplicação)
int w = 10 / 3;    // 3  (divisão inteira!)
double v = 10.0 / 3; // 3.333... (divisão decimal)
int r = 10 % 3;    // 1  (resto da divisão)
```

### Controle de Fluxo - Condicionais
```java
if (x > 10) {
    System.out.println("Maior que 10");
} else if (x == 10) {
    System.out.println("É igual a 10");
} else {
    System.out.println("Menor que 10");
}
```

### Controle de Fluxo - Loops
```java
// while
int i = 0;
while (i < 5) {
    System.out.println(i);
    i++;
}

// for
for (int i = 0; i < 5; i++) {
    System.out.println(i);
}
```

### ⚠️ Erros Comuns
- `=` é **atribuição** (ex: `x = 5`), `==` é **comparação** (ex: `if (x == 5)`)
- `boolean` e `int` NÃO são compatíveis em Java
- Arquivo precisa ter o mesmo nome da classe pública

### 🏋️ Exercício Prático
Crie um programa `Contador.java` que:
1. Declare variáveis `int`
2. Use um loop `for` para contar de 1 a 10
3. Use `if/else` para verificar se o número é par ou ímpar
4. Imprima o resultado

```java
public class Contador {
    public static void main(String[] args) {
        for (int i = 1; i <= 10; i++) {
            if (i % 2 == 0) {
                System.out.println(i + " é par");
            } else {
                System.out.println(i + " é ímpar");
            }
        }
    }
}
```

**Status da Aula 01:** ⬜ Pendente

---

## Aula 02 - Classes e Objetos (Capítulo 2)

**Livrinho:** Use a Cabeça Java, Capítulo 2 - "Uma Viagem a Objectville"

### Conceitos-Chave
- **Classe (Class):** O "molde" (blueprint) para criar objetos. Define o que um objeto **sabe** (variáveis de instância) e o que **faz** (métodos)
- **Objeto (Object):** Uma instância concreta de uma classe. Criado com `new`

### Diferença entre Procedural e POO
- **Procedural:** "Que **procedimentos** precisamos?" (funções soltas)
- **POO:** "Que **coisas/classes** existem neste programa?" (objetos que interagem)

### Anatomy de uma Classe
```java
public class Dog {
    // Variáveis de instância (o que o objeto SABE)
    int size;
    String name;

    // Métodos (o que o objeto FAZ)
    void bark() {
        if (size > 60) {
            System.out.println("WOOF! WOOF!");
        } else {
            System.out.println("yip yip");
        }
    }
}
```

### Criando e Usando Objetos
```java
public class DogTestDrive {
    public static void main(String[] args) {
        Dog d = new Dog();  // Criar objeto (alocar memória no Heap)
        d.size = 40;        // Atribuir valor via operador '.'
        d.bark();           // Chamar método via operador '.'
    }
}
```

### O que acontece quando você faz `new`?
1. JVM aloca memória no **Heap** (área de memória para objetos)
2. Inicializa variáveis de instância com valores padrão
3. Executa o construtor
4. Retorna a **referência** (endereço) do objeto

### Referência vs Objeto
- `Dog d = new Dog();` → `d` é uma **referência** (controle remoto), não o objeto em si
- `d` aponta para o objeto no Heap
- É como um **controle remoto** que controla a TV (o objeto)

### Heap e Garbage Collector
- Objetos ficam no **Heap**
- Quando ninguém referencia um objeto mais, ele fica **elegível para Garbage Collection**
- O GC limpa a memória automaticamente

### 🏋️ Exercício Prático
Crie classes `Carro` e `CarroTestDrive`:

```java
public class Carro {
    String cor;
    int velocidade;
    boolean ligado;

    void acelerar() {
        if (ligado) {
            velocidade = velocidade + 10;
            System.out.println("Velocidade: " + velocidade);
        } else {
            System.out.println("Ligue o carro primeiro!");
        }
    }

    void ligar() {
        ligado = true;
        System.out.println("Carro ligado!");
    }
}
```

**Status da Aula 02:** ⬜ Pendente

---

## Aula 03 - Variáveis: Primitivos e Referências (Capítulo 3)

**Livrinho:** Use a Cabeça Java, Capítulo 3 - "Conheça suas Variáveis"

### Dois Tipos de Variáveis
1. **Primitivos** → Guardam valores reais (números, booleanos, caracteres)
2. **Referências** → Guardam o endereço de objetos no Heap

### Variáveis Primitivas
```java
int x = 7;          // inteiro
double pi = 3.14;   // decimal
boolean ativo = true; // verdadeiro/falso
char letra = 'A';   // um caractere
```

### Variáveis de Referência
```java
Dog fido = new Dog(); // fido é uma REFERÊNCIA, não o objeto
String nome = "Rex";  // String também é um objeto!
```

### Regras de Naming
- Começa com letra, underscore `_` ou cifrão `$`
- NÃO pode começar com número
- NÃO pode usar palavras reservadas (`class`, `public`, `int`, etc.)
- Convensão: camelCase (`meuVariavel`, `nomeCompleto`)

### Tipos de Variáveis
| Tipo | Onde é declarada | Escopo |
|------|-----------------|--------|
| **Instância** | Dentro da classe, fora de métodos | Toda a classe |
| **Local** | Dentro de um método | Aquele método |
| **Argumento** | No parâmetro de um método | Aquele método |

### Arrays - Como Bandejas de Copos
```java
int[] nums = new int[3];     // Array com 3 posições
nums[0] = 10;                 // Primeira posição
nums[1] = 20;                 // Segunda posição
nums[2] = 30;                 // Terceira posição

// Ou inicialize direto:
int[] nums = {10, 20, 30};
System.out.println(nums[1]);  // 20
```

- Arrays são **objetos** também!
- Posições começam em **0** (não 1)
- Acesso por **índice**: `array[posicao]`

### Aritmética de Referências
```java
Dog a = new Dog();
Dog b = a;          // b aponta para MESMO objeto que a
a.name = "Rex";
System.out.println(b.name); // "Rex" (mesmo objeto!)

Dog c = new Dog();  // c aponta para objeto DIFERENTE
```

### 🏋️ Exercício Prático
Crie um programa que:
1. Declare um array de 5 `int`s
2. Preencha com números de 1 a 5
3. Use um loop para imprimir todos
4. Crie 2 referências para o mesmo objeto e prove que são o mesmo

**Status da Aula 03:** ⬜ Pendente

---

## Aula 04 - Métodos e Comportamento (Capítulo 4)

**Livrinho:** Use a Cabeça Java, Capítulo 4 - "Como Objetos Se Comportam"

### Conceitos-Chave
- Uma classe define o que um objeto **sabe** (estado) e o que **faz** (comportamento)
- **Métodos** definem o comportamento
- **Variáveis de instância** definem o estado

### Métodos com Parâmetros
```java
public class Dog {
    int size;

    void bark(int volume) {
        for (int i = 0; i < volume; i++) {
            System.out.println("WOOF!");
        }
    }
}
```

### Métodos com Retorno
```java
public int getHeight() {
    return size;
}
```

### Encapsulamento
- **Variáveis de instância** devem ser `private`
- **Métodos** de acesso (`getter`/`setter`) devem ser `public`
- Isso protege o estado do objeto

```java
public class Dog {
    private int size;  // PRIVATE! só acessível dentro da classe

    public int getSize() {    // Getter
        return size;
    }

    public void setSize(int s) {  // Setter
        size = s;
    }
}
```

### Parâmetros e Return
```java
// Método que recebe algo e retorna algo
public int add(int a, int b) {
    return a + b;
}

// Chamando:
int resultado = myDog.add(5, 3);  // resultado = 8
```

### 🏋️ Exercício Prático
Refaça a classe `Dog` com:
1. Variável `size` como `private`
2. Métodos `getSize()` e `setSize()`
3. Método `bark()` que usa o valor de `size` para decidir o volume
4. Método `getName()` e `setName()`

**Status da Aula 04:** ⬜ Pendente

---

## Aula 05 - Fluxo de Controle Avançado (Capítulo 5)

**Livrinho:** Use a Cabeça Java, Capítulo 5 - "Métodos Extra-Poderosos"

### Operadores
```java
// Aritméticos: + - * / %
// Comparação: == != < > <= >=
// Lógicos: && (E) || (OU) ! (NÃO)
// Atribuição: = += -= *= /=

// Exemplo:
boolean resultado = (x > 5) && (y < 10);  // E
boolean resultado2 = (x > 5) || (y < 10); // OU
boolean resultado3 = !ativo;              // NÃO
```

### Loops Avançados
```java
// for
for (int i = 0; i < 10; i++) { }

// while
while (condition) { }

// do-while (executa pelo menos uma vez)
do {
    // código
} while (condition);
```

### Jogo: Sink a Dot Com (Batalha Naval)
Projeto prático do livro - um jogo onde você tenta afundar sites na grade:
- Grade 7x7
- 3 "Dot Com" posicionados aleatoriamente
- Jogador informa coordenada (0-6)
- Acerto ou erro

**Status da Aula 05:** ⬜ Pendente

---

## Aula 06 - Biblioteca Java (Capítulo 6)

**Livrinho:** Use a Cabeça Java, Capítulo 6 - "Usando a Biblioteca Java"

### Conceitos-Chave
- **Java API** = centenas de classes pré-prontas
- Não reinvente a roda!

### ArrayList - Lista Dinâmica
```java
import java.util.ArrayList;

ArrayList<String> lista = new ArrayList<String>();

lista.add("Elemento 1");     // Adiciona
lista.add("Elemento 2");
lista.remove(0);              // Remove pelo índice
lista.get(0);                 // Acessa pelo índice
lista.size();                 // Tamanho
```

### Diferença: Array vs ArrayList
| Array | ArrayList |
|-------|-----------|
| Tamanho fixo | Tamanho dinâmico |
| `int[] nums = new int[3]` | `ArrayList<Integer> nums = new ArrayList<>()` |
| `nums[0]` | `nums.get(0)` |
| `nums.length` | `nums.size()` |

### Strings - Um Tipo Especial
```java
String s = "Java";
s.length();              // 4
s.charAt(0);            // 'J'
s.substring(0, 3);      // "Jav"
s.toUpperCase();        // "JAVA"
s.indexOf("a");         // 1
```

### 🏋️ Exercício Prático
Refatore o jogo DotCom para usar `ArrayList` em vez de array fixo.

**Status da Aula 06:** ⬜ Pendente

---

## Aula 07 - Herança e Polimorfismo (Capítulo 7)

**Livrinho:** Use a Cabeça Java, Capítulo 7 - "Melhor Vida em Objectville"

### Herança
```java
public class Animal {
    public void comer() {
        System.out.println("Comendo...");
    }
}

public class Cachorro extends Animal {
    public void latir() {
        System.out.println("Au au!");
    }
}

// Cachorro HERDA o método comer() de Animal
```

### Conceitos
- **Superclasse (pai):** Classe de onde se herda
- **Subclasse (filho):** Classe que herda
- **IS-A:** Cachorro É-UM Animal
- **HAS-A:** Cachorro TEM-UM nome (composição)

### Polimorfismo
```java
Animal a = new Cachorro();  // Referência Animal, objeto Cachorro
a.comer();   // Funciona (herdado)
// a.latir(); // ERRO! Referência é Animal, não vê métodos de Cachorro
```

### Sobrescrita de Métodos (Override)
```java
public class Animal {
    public void som() {
        System.out.println("...");
    }
}

public class Gato extends Animal {
    @Override
    public void som() {
        System.out.println("Miau!");
    }
}
```

### Regras de Override
1. Mesmo nome de método
2. Mesmos parâmetros
3. Retorno igual ou subtipo
4. Acesso NÃO pode ser mais restritivo
5. Apenas métodos não-`final`, não-`static`, não-`private`

**Status da Aula 07:** ⬜ Pendente

---

## Aula 08 - Interfaces e Classes Abstratas (Capítulo 8)

**Livrinho:** Use a Cabeça Java, Capítulo 8 - "Polimorfismo Sério"

### Classe Abstrata
```java
public abstract class Animal {
    public abstract void som();  // Sem corpo!

    public void dormir() {      // Método concreto
        System.out.println("Zzz...");
    }
}
```
- **Abstrata** = não pode ser instanciada (`new Animal()` é proibido)
- **Abstrata** = força subclasses a implementar métodos abstratos

### Interface
```java
public interface Nadador {
    void nadar();  // Todos os métodos são public abstract por padrão
}

public class Cachorro extends Animal implements Nadador {
    @Override
    public void nadar() {
        System.out.println("Cachorro nadando!");
    }
}
```
- Interface é um **contrato**: "toda classe que IMPLEMENTA esta interface DEVE ter estes métodos"
- Uma classe pode implementar **VÁRIAS** interfaces
- Uma classe pode herdar de **APENAS UM** pai

### Abstrata vs Interface
| Abstrata | Interface |
|----------|-----------|
| Pode ter métodos concretos | Apenas abstratos (até Java 7) |
| Uma só herança | Múltiplas implementações |
| `extends` | `implements` |

**Status da Aula 08:** ⬜ Pendente

---

## Aula 09 - Construtores e Memória (Capítulo 9)

**Livrinho:** Use a Cabeça Java, Capítulo 9 - "Vida e Morte de um Objeto"

### Construtor
```java
public class Dog {
    private String nome;
    private int size;

    // Construtor
    public Dog(String n, int s) {
        nome = n;
        size = s;
    }
}

// Usando:
Dog d = new Dog("Rex", 30);
```

### Regras
- Chamado quando você faz `new`
- Pode ter **sobrecarga** (vários construtores com assinaturas diferentes)
- Se não criar nenhum, Java cria um **default** (sem parâmetros)
- `this()` chama outro construtor da mesma classe

### Pilha (Stack) vs Heap
| Stack | Heap |
|-------|------|
| Variáveis locais | Objetos |
| Chamadas de método | Variáveis de instância |
| Rápido, tamanho fixo | Dinâmico, mais lento |

### Garbage Collector
- Libera memória de objetos **sem referências**
- É automático (não precisa fazer nada)
- `System.gc()` sugere ao JVM que pode coletar lixo (mas não garante)

**Status da Aula 09:** ⬜ Pendente

---

## Aula 10 - Números, Math e Static (Capítulo 10)

**Livrinho:** Use a Cabeça Java, Capítulo 10 - "Números Importam"

### Math Library
```java
Math.random();      // 0.0 a 1.0
Math.round(3.7);    // 4
Math.ceil(3.2);     // 4.0
Math.floor(3.7);    // 3.0
Math.abs(-5);        // 5
Math.max(3, 7);     // 7
Math.sqrt(16);       // 4.0
```

### Wrappers (Auto-boxing)
```java
int x = 7;
Integer obj = x;        // Auto-boxing: int → Integer
int y = obj;            // Auto-unboxing: Integer → int

Double d = 3.14;
Boolean b = true;
```

### Static
```java
public class Contador {
    static int total = 0;  // Variável COMPARTILHADA por todas as instâncias

    public Contador() {
        total++;
    }

    public static void imprimirTotal() {  // Método sem precisar de objeto
        System.out.println("Total: " + total);
    }
}
```
- `static` = pertence à **classe**, não ao objeto
- Método `static` pode ser chamado sem criar objeto

### Formatação de Strings
```java
String.format("Preço: R$ %.2f", 19.90);  // "Preço: R$ 19.90"
```

**Status da Aula 10:** ⬜ Pendente

---

## Aula 11 - Tratamento de Exceções (Capítulo 11)

**Livrinho:** Use a Cabeça Java, Capítulo 11 - "Comportamento Arriscado"

### O que são Exceções
- **Checked exceptions** (compilador obriga a tratar): `IOException`
- **Unchecked exceptions** (podem passar batido): `NullPointerException`, `ArithmeticException`
- **Errors** (problemas graves do sistema): `OutOfMemoryError`

### Try-Catch-Finally
```java
try {
    int x = 10 / 0;
} catch (ArithmeticException e) {
    System.out.println("Erro: divisão por zero!");
} finally {
    System.out.println("Sempre executa!");
}
```

### Lançando Exceções
```java
public void setAltura(int altura) {
    if (altura < 0) {
        throw new IllegalArgumentException("Altura não pode ser negativa");
    }
    this.altura = altura;
}
```

### Multi-catch (Java 7+)
```java
try {
    // código arriscado
} catch (IOException | SQLException e) {
    System.out.println("Erro de I/O ou SQL: " + e.getMessage());
}
```

**Status da Aula 11:** ⬜ Pendente

---

## Aula 12 - Collections e Generics (Capítulo 12)

**Livrinho:** Use a Cabeça Java, Capítulo 12 - "Estruturas de Dados"

### Coleções
```java
import java.util.*;

// TreeMap - ordenado por chave
TreeMap<String, Integer> map = new TreeMap<>();
map.put("Rex", 5);
map.get("Rex");  // 5

// HashSet - sem duplicatas
HashSet<String> set = new HashSet<>();
set.add("Java");
set.add("Java");  // Ignorado!

// LinkedList - lista encadeada
LinkedList<String> list = new LinkedList<>();
list.addFirst("Primeiro");
list.addLast("Último");
```

### Generics
```java
ArrayList<String> lista = new ArrayList<>();  // Só aceita String
// lista.add(42);  // ERRO de compilação!
```

### Hierarquia de Coleções
```
Collection (interface)
├── List (interface) - ordenada, permite duplicatas
│   ├── ArrayList
│   └── LinkedList
├── Set (interface) - sem duplicatas
│   ├── HashSet
│   └── TreeSet (ordenado)
└── Queue (interface) - fila

Map (interface) - pares chave-valor
├── HashMap
├── TreeMap
└── LinkedHashMap
```

**Status da Aula 12:** ⬜ Pendente

---

## Aula 13 - Streams e Lambda (Capítulo 13 - 3ª Edição)

**Livrinho:** Use a Cabeça Java, Capítulo 13 (3ª edição)

### Lambda Expressions
```java
// Antes:
Runnable r = new Runnable() {
    @Override
    public void run() {
        System.out.println("Executando");
    }
};

// Com Lambda:
Runnable r = () -> System.out.println("Executando");
```

### Streams API
```java
import java.util.stream.*;

List<String> nomes = Arrays.asList("Ana", "Bruno", "Carlos", "Diana");

// Filtrar e processar:
nomes.stream()
     .filter(n -> n.length() > 4)
     .map(String::toUpperCase)
     .sorted()
     .forEach(System.out::println);
```

### Onde é útil
- Processamento de coleções de forma funcional
- Paralelismo fácil
- Código mais limpo e legível

**Status da Aula 13:** ⬜ Pendente

---

## Aula 14-15 - GUI, Swing e Eventos (Capítulos 14-15)

**Livrinho:** Use a Cabeça Java, Capítulos 14-15

### Conceitos de GUI
- **Swing** = biblioteca para interfaces gráficas
- **Componentes:** `JFrame`, `JButton`, `JTextField`, `JLabel`
- **Eventos:** O que acontece quando o usuário clica

```java
import javax.swing.*;

public class MeuFrame extends JFrame {
    public MeuFrame() {
        JButton botao = new JButton("Clique aqui");
        botao.addActionListener(e -> {
            JOptionPane.showMessageDialog(null, "Olá!");
        });
        add(botao);
        setSize(300, 200);
        setVisible(true);
    }
}
```

**Status da Aula 14-15:** ⬜ Pendente

---

## Aula 16 - Serialização e I/O (Capítulo 16)

**Livrinho:** Use a Cabeça Java, Capítulo 16

### Serialização
- Transformar objeto em **bytes** (salvar em arquivo)
- Desserialização: transformar bytes de volta em objeto

```java
import java.io.*;

// Serializar (salvar):
ObjectOutputStream oos = new ObjectOutputStream(
    new FileOutputStream("objeto.ser")
);
oos.writeObject(meupessoa);

// Desserializar (carregar):
ObjectInputStream ois = new ObjectInputStream(
    new FileInputStream("objeto.ser")
);
Pessoa p = (Pessoa) ois.readObject();
```

- Objeto precisa implementar `Serializable`
- Usar `transient` para campos que NÃO devem ser salvos

**Status da Aula 16:** ⬜ Pendente

---

## Aula 17 - Networking e Sockets (Capítulo 17)

**Livrinho:** Use a Cabeça Java, Capítulo 17

### Sockets
```java
// Servidor:
ServerSocket serverSocket = new ServerSocket(5000);
Socket socket = serverSocket.accept();

// Cliente:
Socket socket = new Socket("localhost", 5000);
PrintWriter out = new PrintWriter(socket.getOutputStream(), true);
out.println("Olá servidor!");
```

### Chat Client (Projeto do Livro)
- Cliente conecta ao servidor
- Pode enviar/receber mensagens
- Usa threads para enviar e receber ao mesmo tempo

**Status da Aula 17:** ⬜ Pendente

---

## Aula 18 - Multithreading (Capítulo 18)

**Livrinho:** Use a Cabeça Java, Capítulo 18

### Threads
```java
// Criando thread com Runnable
Runnable tarefa = () -> {
    for (int i = 0; i < 5; i++) {
        System.out.println(Thread.currentThread().getName() + ": " + i);
    }
};

Thread t = new Thread(tarefa);
t.start();  // NÃO use t.run()!
```

### Sincronização
```java
public synchronized void metodo() {
    // Apenas uma thread por vez pode executar
}
```

### Riscos
- **Race conditions:** Duas threads modificam o mesmo dado
- **Deadlock:** Duas threads esperando uma pela outra

**Status da Aula 18:** ⬜ Pendente

---

## Resumo de Conceitos por Aula (Para Revisão Rápida)

### Fundamentos (Aulas 1-6)
- Compilar e rodar Java
- Classes, objetos, referências
- Primitivos vs Referências
- Métodos, parâmetros, retorno
- Encapsulamento
- Controle de fluxo (if, for, while)
- ArrayList, Strings, Java API

### POO (Aulas 7-9)
- Herança (`extends`)
- Polimorfismo
- Override de métodos
- Interfaces (`implements`)
- Classes abstratas (`abstract`)
- Construtores
- Heap vs Stack
- Garbage Collector

### Intermediário (Aulas 10-12)
- Math, Static, Wrappers
- Auto-boxing/Unboxing
- Exceções (try-catch-finally)
- Collections (List, Set, Map)
- Generics

### Avançado (Aulas 13-18)
- Lambdas e Streams
- GUI com Swing
- Serialização
- Networking (Sockets)
- Multithreading

---

## Ambiente de Desenvolvimento

### O que você precisa:
1. **JDK 8+** (recomendado: JDK 11 ou 17 LTS)
2. **IDE** (escolha uma):
   - VS Code com extensão Java
   - IntelliJ IDEA Community (grátis)
   - Eclipse (grátis)
3. **Editor de texto** (para exercícios rápidos)

### Verificar instalação:
```bash
java -version
javac -version
```

### Compilar e rodar manualmente:
```bash
javac MeuPrograma.java
java MeuPrograma
```

---

*Dicas de Estudo:*
1. Leia o capítulo no livro
2. Execute o código exemplo
3. Faça os exercícios "Sharpen Your Pencil"
4. Resolva os puzzles e desafios
5. Reforce com os exercícios deste roteiro
6. Passe para o próximo capítulo quando se sentir confortável
