public class Condicionais {
    public static void main(String[] args) {
        int idade = 20;

        if (idade >= 18) {
            System.out.println("Maior de idade!");
        } else {
            System.out.println("Menor de idade!");
        }

        // Mais de uma condição
        int nota = 85;

        if (nota >= 90) {
            System.out.println("Excelente!");
        } else if (nota >= 70) {
            System.out.println("Bom!");
        } else if (nota >= 50) {
            System.out.println("Regular");
        } else {
            System.out.println("Reprovado");
        }
    }
}
