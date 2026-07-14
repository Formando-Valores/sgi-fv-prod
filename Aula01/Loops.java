public class Loops {
    public static void main(String[] args) {

        // Loop FOR - contagem de 1 a 5
        System.out.println("--- Loop FOR ---");
        for (int i = 1; i <= 5; i++) {
            System.out.println("Contagem: " + i);
        }

        // Loop WHILE
        System.out.println("\n--- Loop WHILE ---");
        int contador = 1;
        while (contador <= 5) {
            System.out.println("Contador: " + contador);
            contador++;
        }

        // Exercício: Tabuada do 7
        System.out.println("\n--- Tabuada do 7 ---");
        for (int i = 1; i <= 10; i++) {
            System.out.println("7 x " + i + " = " + (7 * i));
        }
    }
}
